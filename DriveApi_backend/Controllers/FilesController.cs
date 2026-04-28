using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Drive.Models;
using System.Security.Claims;

namespace Drive.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class FilesController : ControllerBase
{
    private readonly DefaultDbContext _context;
    private readonly IWebHostEnvironment _env;

    // El límite de tamaño de archivo es 10 MB, igual que dice el spec
    private const long MaxFileSizeBytes = 10 * 1024 * 1024;

    public FilesController(DefaultDbContext context, IWebHostEnvironment env)
    {
        _context = context;
        _env     = env;
    }

    private int CurrentUserId() =>
        int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private bool IsAdmin() =>
        User.FindFirst(ClaimTypes.Role)?.Value == "1";

    // La carpeta donde guardamos los archivos en el servidor
    private string UploadsFolder =>
        Path.Combine(_env.ContentRootPath, "uploads");

    // ── GET /api/files?directoryId=5 ──────────────────────────────────────────
    // Lista paginada de archivos dentro de una carpeta.
    // Soporta filtros por nombre, tipo, fecha de subida y propietario.
    [HttpGet]
    public async Task<IActionResult> GetFiles(
        int    directoryId,
        string? nombre     = null,
        string? tipo       = null,
        string? fecha      = null,
        string? propietario = null,
        int     page       = 1,
        int     pageSize   = 10)
    {
        // Verificamos que el directorio exista
        var dirExists = await _context.Directories.AnyAsync(d => d.Id == directoryId);
        if (!dirExists)
            return NotFound(new { message = "Directorio no encontrado." });

        var query = _context.Files
            .Where(f => f.DirectoryId == directoryId)
            .Include(f => f.Owner)
            .AsQueryable();

        // Filtros como subcadenas, igual que en el spec
        if (!string.IsNullOrEmpty(nombre))
            query = query.Where(f => f.Name.Contains(nombre));

        if (!string.IsNullOrEmpty(tipo))
            query = query.Where(f => f.ContentType.Contains(tipo));

        if (!string.IsNullOrEmpty(fecha))
            query = query.Where(f => f.CreatedAt.ToString().Contains(fecha));

        if (!string.IsNullOrEmpty(propietario))
            query = query.Where(f => f.Owner!.Name.Contains(propietario));

        var total = await query.CountAsync();

        var files = await query
            .OrderBy(f => f.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(f => new
            {
                f.Id,
                f.Name,
                f.ContentType,
                SizeMB = Math.Round((double)f.Size / (1024 * 1024), 2),
                f.DirectoryId,
                f.CreatedAt,
                f.UpdatedAt,
                Owner = new { f.Owner!.Id, f.Owner.Name }
            })
            .ToListAsync();

        return Ok(new { total, page, pageSize, data = files });
    }

    // ── POST /api/files/upload ────────────────────────────────────────────────
    // Sube un archivo a una carpeta. El archivo viene como multipart/form-data.
    // Recuerda: los archivos no pueden subirse a la raíz, solo dentro de carpetas.
    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] int directoryId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No se proporcionó ningún archivo." });

        if (file.Length > MaxFileSizeBytes)
            return BadRequest(new { message = "El archivo excede el límite de 10 MB." });

        // Verificamos que el directorio destino exista
        var dir = await _context.Directories.FindAsync(directoryId);
        if (dir == null)
            return NotFound(new { message = "El directorio de destino no existe." });

        // Generamos un nombre único en disco para evitar colisiones.
        // El nombre original se guarda en la base de datos; en disco usamos un GUID.
        var extension  = Path.GetExtension(file.FileName);
        var storedName = $"{Guid.NewGuid()}{extension}";
        var filePath   = Path.Combine(UploadsFolder, storedName);

        // Guardamos el archivo en disco
        using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        var fileItem = new FileItem
        {
            Name        = file.FileName,
            StoredName  = storedName,
            ContentType = file.ContentType,
            Size        = file.Length,
            DirectoryId = directoryId,
            OwnerId     = CurrentUserId()
        };

        _context.Files.Add(fileItem);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Archivo subido correctamente.", id = fileItem.Id });
    }

    // ── GET /api/files/{id}/download ──────────────────────────────────────────
    // Cualquier usuario autenticado puede descargar cualquier archivo.
    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(int id)
    {
        var file = await _context.Files.FindAsync(id);
        if (file == null)
            return NotFound(new { message = "Archivo no encontrado." });

        var filePath = Path.Combine(UploadsFolder, file.StoredName);
        if (!System.IO.File.Exists(filePath))
            return NotFound(new { message = "El archivo existe en la base de datos pero no en el servidor." });

        // PhysicalFile se encarga de enviar el archivo con el Content-Type correcto
        // y el nombre original para que el navegador lo muestre bien al descargar.
        return PhysicalFile(filePath, file.ContentType, file.Name);
    }

    // ── PUT /api/files/{id} ───────────────────────────────────────────────────
    // Renombra un archivo. Solo su dueño o un admin.
    [HttpPut("{id}")]
    public async Task<IActionResult> RenameFile(int id, RenameRequest body)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var file = await _context.Files.FindAsync(id);
        if (file == null)
            return NotFound(new { message = "Archivo no encontrado." });

        if (file.OwnerId != CurrentUserId() && !IsAdmin())
            return Forbid();

        file.Name      = body.Name;
        file.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return Ok(new { message = "Archivo renombrado." });
    }

    // ── DELETE /api/files/{id} ────────────────────────────────────────────────
    // Elimina un archivo. Solo su dueño o un admin.
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteFile(int id)
    {
        var file = await _context.Files.FindAsync(id);
        if (file == null)
            return NotFound(new { message = "Archivo no encontrado." });

        if (file.OwnerId != CurrentUserId() && !IsAdmin())
            return Forbid();

        // Borramos el archivo físico del disco
        var filePath = Path.Combine(UploadsFolder, file.StoredName);
        if (System.IO.File.Exists(filePath))
            System.IO.File.Delete(filePath);

        // Y borramos el registro de la base de datos
        _context.Files.Remove(file);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Archivo eliminado." });
    }
}
