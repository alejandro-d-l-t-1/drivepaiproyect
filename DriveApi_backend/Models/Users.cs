using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Security.Cryptography;
using System.Text;

namespace Drive.Models;

public class User
{
    [Key]
    [Required]
    public int Id { get; set; }

    [Required]
    [DataType("Date")]
    public DateTime Birth { get; set; }

    [Required]
    public string Name { get; set; } = null!;

    [Required]
    public string Email { get; set; } = null!;

    [Required]
    public string Password { get; set; } = null!;

    [Required]
    public int Role { get; set; }

    [Required]
    public bool Active { get; set; } = false;

    [Column("Created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("Updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;


    public static string GetHash(string input)
    {
        byte[] inputBytes = Encoding.UTF8.GetBytes(input);
        byte[] hashedBytes = MD5.HashData(inputBytes);
        return BitConverter.ToString(hashedBytes).Replace("-", "");;
    }
}

public class UserCredentials
{
    [Required]
    public string Email { get; set; } = null!;

    [Required]
    public string Password { get; set; } = null!;
}

public class CreateUser
{
    public string? Name { get; set; }

    [EmailAddress(ErrorMessage = "La dirección no pertenece a un dirección de correo válida")]
    [Required(ErrorMessage = "El campo es obligatorio")]
    public string? Email { get; set; }

    [DataType("Date")]
    [Required]
    public DateTime Birth { get; set; }

    [DataType(DataType.Password)]
    [Required]
    public string? Password { get; set; }

    [DataType(DataType.Password)]
    [Required]
    [Compare("Password", ErrorMessage = "Las contraseñas no coinciden")]
    [DisplayName("Password Confirm")]
    public string? PasswordConfirm { get; set; }

    [AllowedValues(0, 1, ErrorMessage = "Rol inválido")]
    public int Role { get; set; } = 0;

    public bool Active { get; set; } = false;
}