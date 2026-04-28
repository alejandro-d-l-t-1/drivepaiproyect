using Microsoft.EntityFrameworkCore;

namespace Drive.Models;

public class DefaultDbContext(DbContextOptions<DefaultDbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; }
    public DbSet<DirectoryItem> Directories { get; set; }
    public DbSet<FileItem> Files { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Una carpeta puede tener sub-carpetas (relación consigo misma)
        modelBuilder.Entity<DirectoryItem>()
            .HasOne(d => d.Parent)
            .WithMany(d => d.SubDirectories)
            .HasForeignKey(d => d.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Si se borra una carpeta, se borran sus archivos
        modelBuilder.Entity<FileItem>()
            .HasOne(f => f.Directory)
            .WithMany(d => d.Files)
            .HasForeignKey(f => f.DirectoryId)
            .OnDelete(DeleteBehavior.Cascade);

        base.OnModelCreating(modelBuilder);
    }
}