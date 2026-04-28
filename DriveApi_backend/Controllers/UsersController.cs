using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Drive.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Drive.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]           // Todos los endpoints de este controller requieren estar logueado
public class UserController : ControllerBase
{
    private readonly DefaultDbContext _context;

    public UserController(DefaultDbContext context)
    {
        _context = context;
    }

    // Método auxiliar: obtiene el ID del usuario que está haciendo la petición
    // (lo saca del token JWT)
    private int GetCurrentUserId() =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private bool CurrentUserIsAdmin() =>
        User.FindFirst(ClaimTypes.Role)?.Value == "1";

    // ── GET /api/user ─────────────────────────────────────────────────────────
    // Lista paginada de usuarios. Solo admins.
    // Parámetros opcionales de filtro: ?nombre=jo&correo=&rol=0&page=1&pageSize=10
    [Authorize(Policy = "AdminOnly")]
    [HttpGet]
    public async Task<IActionResult> GetUsers(
        string? nombre   = null,
        string? correo   = null,
        string? fechaNac = null,
        int?    rol      = null,
        int     page     = 1,
        int     pageSize = 10)
    {
        if (page < 1)     page     = 1;
        if (pageSize < 1) pageSize = 10;

        var query = _context.Users.AsQueryable();

        // Filtros como subcadenas (spec: "jo" debe encontrar "Jorge", "Alejandra", etc.)
        if (!string.IsNullOrEmpty(nombre))
            query = query.Where(u => u.Name.Contains(nombre));

        if (!string.IsNullOrEmpty(correo))
            query = query.Where(u => u.Email.Contains(correo));

        if (!string.IsNullOrEmpty(fechaNac))
            query = query.Where(u => u.Birth.ToString().Contains(fechaNac));

        if (rol.HasValue)
            query = query.Where(u => u.Role == rol.Value);

        var total = await query.CountAsync();

        var users = await query
            .OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)   // Bug corregido: el original usaba .Skip(page) directo
            .Take(pageSize)
            .Select(u => new             // No devolvemos la contraseña
            {
                u.Id, u.Name, u.Email, u.Role,
                u.Active, u.Birth, u.CreatedAt, u.UpdatedAt
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = users });
    }

    // ── GET /api/user/{id} ────────────────────────────────────────────────────
    [Authorize(Policy = "AdminOnly")]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetUserById(int id)
    {
        var user = await _context.Users
            .Where(u => u.Id == id)
            .Select(u => new
            {
                u.Id, u.Name, u.Email, u.Role,
                u.Active, u.Birth, u.CreatedAt, u.UpdatedAt
            })
            .FirstOrDefaultAsync();

        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        return Ok(user);
    }

    // ── POST /api/user ────────────────────────────────────────────────────────
    // Un admin crea un usuario. Puede asignarle rol de admin.
    [Authorize(Policy = "AdminOnly")]
    [HttpPost]
    public async Task<IActionResult> CreateUser(CreateUser userData)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (await _context.Users.AnyAsync(u => u.Email == userData.Email))
            return Conflict(new { message = "Ya existe un usuario con ese correo." });

        // Si el que crea NO es admin, no puede asignar rol admin
        if (userData.Role == 1 && !CurrentUserIsAdmin())
            return Forbid();

        var newUser = new User
        {
            Name     = userData.Name ?? "",
            Email    = userData.Email!,
            Password = Models.User.GetHash(userData.Password!),
            Birth    = userData.Birth,
            Role     = userData.Role,
            Active   = userData.Active
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Usuario creado.", id = newUser.Id });
    }

    // ── PUT /api/user/{id} ────────────────────────────────────────────────────
    // Editar datos de un usuario. Solo admins.
    [Authorize(Policy = "AdminOnly")]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(int id, CreateUser userData)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        // Un admin no puede quitarse su propio rol de admin
        if (user.Id == GetCurrentUserId() && user.Role == 1 && userData.Role != 1)
            return BadRequest(new { message = "No puedes revocar tu propio rol de administrador." });

        // Verificamos que el nuevo correo no lo tenga otro usuario
        if (await _context.Users.AnyAsync(u => u.Email == userData.Email && u.Id != id))
            return Conflict(new { message = "Ese correo ya está en uso por otro usuario." });

        user.Name      = userData.Name ?? user.Name;
        user.Email     = userData.Email ?? user.Email;
        user.Birth     = userData.Birth;
        user.Role      = userData.Role;
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(userData.Password))
            user.Password = Models.User.GetHash(userData.Password);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Usuario actualizado." });
    }

    // ── PATCH /api/user/{id}/active ───────────────────────────────────────────
    // Activar o desactivar un usuario. Solo admins.
    [Authorize(Policy = "AdminOnly")]
    [HttpPatch("{id}/active")]
    public async Task<IActionResult> ToggleActive(int id, [FromBody] bool active)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null)
            return NotFound(new { message = "Usuario no encontrado" });

        // Un admin no puede desactivarse a sí mismo
        if (user.Id == GetCurrentUserId() && !active)
            return BadRequest(new { message = "No puedes desactivar tu propia cuenta." });

        user.Active    = active;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = active ? "Usuario activado." : "Usuario desactivado." });
    }
}
