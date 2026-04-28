using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Drive.Models;
using System.Security.Claims;

namespace Drive.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class DirectoriesController : ControllerBase
{
    private readonly DefaultDbContext _context;

    public DirectoriesController(DefaultDbContext context)
    {
        _context = context;
    }

    // Helpers para no repetir código en todos los métodos
    private int CurrentUserId() =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private bool IsAdmin() =>
        User.FindFirst(ClaimTypes.Role)?.Value == "1";

    // ── GET /api/directories ───────────────────────────────────────────────────
    // Devuelve los directorios de un nivel. Si no se pasa parentId, devuelve los
    // que están en la raíz (parentId == null).
    [HttpGet]
    public async Task<IActionResult> GetDirectories(
        int?   parentId = null,
        int    page     = 1,
        int    pageSize = 20)
    {
        var query = _context.Directories
            .Where(d => d.ParentId == parentId)  // null == raíz, número == subcarpeta
            .Include(d => d.Owner)
            .AsQueryable();

        var total = await query.CountAsync();

        var dirs = await query
            .OrderBy(d => d.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(d => new
            {
                d.Id,
                d.Name,
                d.ParentId,
                d.CreatedAt,
                d.UpdatedAt,
                Owner = new { d.Owner!.Id, d.Owner.Name }
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = dirs });
    }

    // ── POST /api/directories ─────────────────────────────────────────────────
    // Crea un directorio. El nombre debe ser único dentro del mismo nivel.
    [HttpPost]
    public async Task<IActionResult> CreateDirectory(CreateDirectory body)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // Si se especificó un parentId, verificamos que exista
        if (body.ParentId.HasValue)
        {
            var parentExists = await _context.Directories.AnyAsync(d => d.Id == body.ParentId);
            if (!parentExists)
                return NotFound(new { message = "El directorio padre no existe." });
        }

        // No puede haber dos carpetas con el mismo nombre en el mismo nivel
        var nameExists = await _context.Directories.AnyAsync(d =>
            d.ParentId == body.ParentId &&
            d.Name     == body.Name);

        if (nameExists)
            return Conflict(new { message = "Ya existe un directorio con ese nombre en este nivel." });

        var dir = new DirectoryItem
        {
            Name     = body.Name,
            ParentId = body.ParentId,
            OwnerId  = CurrentUserId()
        };

        _context.Directories.Add(dir);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Directorio creado.", id = dir.Id });
    }

    // ── PUT /api/directories/{id} ─────────────────────────────────────────────
    // Renombrar un directorio. Solo su dueño o un admin.
    [HttpPut("{id}")]
    public async Task<IActionResult> RenameDirectory(int id, RenameRequest body)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var dir = await _context.Directories.FindAsync(id);
        if (dir == null)
            return NotFound(new { message = "Directorio no encontrado." });

        if (dir.OwnerId != CurrentUserId() && !IsAdmin())
            return Forbid();

        // Verificamos que no haya otro con ese nombre en el mismo nivel
        var nameExists = await _context.Directories.AnyAsync(d =>
            d.ParentId == dir.ParentId &&
            d.Name     == body.Name    &&
            d.Id       != id);

        if (nameExists)
            return Conflict(new { message = "Ya existe un directorio con ese nombre en este nivel." });

        dir.Name      = body.Name;
        dir.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Directorio renombrado." });
    }

    // ── DELETE /api/directories/{id} ──────────────────────────────────────────
    // Eliminar. Un usuario común solo puede borrar carpetas vacías que le pertenezcan.
    // Un admin puede borrar cualquier carpeta aunque tenga contenido.
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDirectory(int id)
    {
        var dir = await _context.Directories
            .Include(d => d.SubDirectories)
            .Include(d => d.Files)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (dir == null)
            return NotFound(new { message = "Directorio no encontrado." });

        if (dir.OwnerId != CurrentUserId() && !IsAdmin())
            return Forbid();

        var isEmpty = !dir.SubDirectories.Any() && !dir.Files.Any();

        if (!isEmpty && !IsAdmin())
            return BadRequest(new { message = "No puedes eliminar un directorio que no esté vacío." });

        // Si es admin y no está vacío, borramos todo en cascada de forma recursiva
        if (!isEmpty && IsAdmin())
            await DeleteRecursive(id);
        else
            _context.Directories.Remove(dir);

        await _context.SaveChangesAsync();
        return Ok(new { message = "Directorio eliminado." });
    }

    // Borra recursivamente todos los archivos y subdirectorios de una carpeta.
    // Esto es necesario porque en MySQL las FK con Restrict no borran en cascada.
    private async Task DeleteRecursive(int dirId)
    {
        // 1. Borrar los archivos de este directorio
        var files = await _context.Files.Where(f => f.DirectoryId == dirId).ToListAsync();
        _context.Files.RemoveRange(files);

        // 2. Repetir para cada subdirectorio
        var subDirs = await _context.Directories
            .Where(d => d.ParentId == dirId)
            .ToListAsync();

        foreach (var sub in subDirs)
            await DeleteRecursive(sub.Id);

        // 3. Borrar el directorio en sí
        var dir = await _context.Directories.FindAsync(dirId);
        if (dir != null)
            _context.Directories.Remove(dir);
    }
}
