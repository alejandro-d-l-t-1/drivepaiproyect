using Microsoft.AspNetCore.Mvc;
using Drive.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace Drive.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly DefaultDbContext _context;
    private readonly IConfiguration _config;

    public AuthController(DefaultDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    // POST /api/auth/login
    // El frontend envía { "email": "...", "password": "..." }
    // Devuelve accessToken + refreshToken si todo está bien
    [HttpPost("login")]
    public IActionResult Login(UserCredentials userCredentials)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var user = _context.Users.FirstOrDefault(u => u.Email == userCredentials.Email);

        if (user == null || Models.User.GetHash(userCredentials.Password) != user.Password)
            return Unauthorized(new { message = "Correo o contraseña incorrectos" });

        if (!user.Active)
            return Unauthorized(new { message = "Tu cuenta está desactivada. Contacta a un administrador." });

        var accessToken  = new JwtSecurityTokenHandler().WriteToken(GenerateAccessToken(user));
        var refreshToken = new JwtSecurityTokenHandler().WriteToken(GenerateRefreshToken(user));

        return Ok(new
        {
            accessToken,
            refreshToken,
            user = new { user.Id, user.Name, user.Email, user.Role }
        });
    }

    // POST /api/auth/register
    // Cualquier persona puede crear su cuenta, pero queda DESACTIVADA
    // hasta que un admin la active.
    [HttpPost("register")]
    public IActionResult Register(CreateUser userData)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (_context.Users.Any(u => u.Email == userData.Email))
            return Conflict(new { message = "Ya existe una cuenta con ese correo." });

        var newUser = new User
        {
            Name     = userData.Name ?? "",
            Email    = userData.Email!,
            Password = Models.User.GetHash(userData.Password!),
            Birth    = userData.Birth,
            Role     = 0,
            Active   = false
        };

        _context.Users.Add(newUser);
        _context.SaveChanges();

        return Ok(new { message = "Cuenta creada. Espera a que un administrador la active." });
    }

    // POST /api/auth/getNewAccessToken
    // El frontend manda el refreshToken cuando el accessToken expiró
    [HttpPost("getNewAccessToken")]
    public IActionResult GetNewAccessToken(StringAccessToken body)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_config["JwtSettings:SecretKey"]!);

        try
        {
            var principal = tokenHandler.ValidateToken(body.AccessToken,
                new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey         = new SymmetricSecurityKey(key),
                    ValidateIssuer           = true,
                    ValidIssuer              = _config["JwtSettings:Issuer"],
                    ValidateAudience         = true,
                    ValidAudience            = _config["JwtSettings:Audience"],
                    ValidateLifetime         = false
                },
                out _
            );

            var isAccess = principal.FindFirst("is_access")?.Value;
            if (isAccess == null || isAccess.Equals("true", StringComparison.OrdinalIgnoreCase))
                return Unauthorized(new { message = "Token inválido" });

            var userId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var user   = _context.Users.FirstOrDefault(u => u.Id.ToString() == userId);

            if (user == null || !user.Active)
                return Unauthorized(new { message = "Usuario no encontrado o desactivado" });

            var newAccessToken = new JwtSecurityTokenHandler().WriteToken(GenerateAccessToken(user));
            return Ok(new { accessToken = newAccessToken });
        }
        catch
        {
            return Unauthorized(new { message = "Token inválido o expirado" });
        }
    }

    private JwtSecurityToken GenerateToken(User user, bool isAccess)
    {
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name,           user.Name),
            new Claim("is_access",               isAccess.ToString()),
            new Claim(ClaimTypes.Role,           user.Role.ToString()),
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        };

        return new JwtSecurityToken(
            issuer:    _config["JwtSettings:Issuer"],
            audience:  _config["JwtSettings:Audience"],
            claims:    claims,
            expires:   DateTime.UtcNow.AddMinutes(Convert.ToDouble(
                isAccess ? _config["JwtSettings:AccessTokenDuration"]
                         : _config["JwtSettings:RefreshTokenDuration"]
            )),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["JwtSettings:SecretKey"]!)),
                SecurityAlgorithms.HmacSha256
            )
        );
    }

    private JwtSecurityToken GenerateAccessToken(User user)  => GenerateToken(user, true);
    private JwtSecurityToken GenerateRefreshToken(User user) => GenerateToken(user, false);
}
