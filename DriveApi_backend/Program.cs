using Drive.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using System.Text;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

// ── Base de datos ─────────────────────────────────────────────────────────────
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var serverVersion    = new MySqlServerVersion(new Version(8, 0, 29));
builder.Services.AddDbContext<DefaultDbContext>(options =>
    options.UseMySql(connectionString, serverVersion));

// ── Archivos en disco ─────────────────────────────────────────────────────────
// Necesitamos acceso a IWebHostEnvironment para saber dónde está el servidor
// y así guardar los archivos subidos en una carpeta "uploads/" dentro del proyecto.
builder.Services.AddSingleton<IWebHostEnvironment>(builder.Environment);

// ── JWT Auth ──────────────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience            = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"]!)),
        };

        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = context =>
            {
                // Rechazamos refreshTokens usados como si fueran accessTokens
                var isAccess = context.Principal?
                    .FindFirst("is_access")?.Value
                    .Equals("true", StringComparison.OrdinalIgnoreCase) ?? false;

                if (!isAccess)
                    context.Fail("Token inválido: se esperaba un access token.");

                return Task.CompletedTask;
            }
        };
    });

// ── Políticas de autorización ─────────────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    // "AdminOnly" se usa con [Authorize(Policy = "AdminOnly")] en los controllers
    options.AddPolicy("AdminOnly", policy =>
        policy.RequireClaim(ClaimTypes.Role, "1"));
});

// ── CORS (para que React pueda llamar a la API sin que el navegador la bloquee) ─
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173")  // Puerto por defecto de Vite
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();
builder.Services.AddControllers();

var app = builder.Build();

// ── Crear la carpeta de uploads si no existe ──────────────────────────────────
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "uploads");
if (!Directory.Exists(uploadsPath))
    Directory.CreateDirectory(uploadsPath);

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

// El orden importa: primero CORS, luego Auth, luego Authorization
app.UseCors("DevPolicy");
app.UseHttpsRedirection();
app.UseAuthentication();   // ← Este faltaba en el original (sin él el [Authorize] no funciona)
app.UseAuthorization();
app.MapControllers();

app.Run();
