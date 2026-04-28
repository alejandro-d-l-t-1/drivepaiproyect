using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Drive.Models;

// Representa una carpeta en el repositorio
public class DirectoryItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    // Si es null, está en la raíz del repositorio
    public int? ParentId { get; set; }

    // El usuario que creó esta carpeta
    [Required]
    public int OwnerId { get; set; }

    [Column("Created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("Updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navegación (Entity Framework las usa internamente para hacer JOINs)
    public User? Owner { get; set; }
    public DirectoryItem? Parent { get; set; }
    public ICollection<DirectoryItem> SubDirectories { get; set; } = [];
    public ICollection<FileItem> Files { get; set; } = [];
}

// Representa un archivo subido al repositorio
public class FileItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    // Nombre único en disco para evitar colisiones (un GUID)
    [Required]
    public string StoredName { get; set; } = null!;

    // Tipo MIME: "image/png", "application/pdf", etc.
    [Required]
    [MaxLength(100)]
    public string ContentType { get; set; } = null!;

    // Tamaño en bytes
    public long Size { get; set; }

    // La carpeta donde vive este archivo
    [Required]
    public int DirectoryId { get; set; }

    // El usuario que subió el archivo
    [Required]
    public int OwnerId { get; set; }

    [Column("Created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("Updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navegación
    public User? Owner { get; set; }
    public DirectoryItem? Directory { get; set; }
}

// DTO para crear un directorio (lo que el frontend envía)
public class CreateDirectory
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [MaxLength(255)]
    public string Name { get; set; } = null!;

    public int? ParentId { get; set; }
}

// DTO para renombrar un archivo o directorio
public class RenameRequest
{
    [Required(ErrorMessage = "El nuevo nombre es obligatorio")]
    [MaxLength(255)]
    public string Name { get; set; } = null!;
}
