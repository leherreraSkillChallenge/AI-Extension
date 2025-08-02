using System.Net.NetworkInformation;
using System.Net;

public class NetworkValidator
{
    public static async Task ValidarConectividadDocker()
    {
        Console.WriteLine("=== VALIDACIÓN DE CONECTIVIDAD DOCKER ===\n");

        var servicios = new Dictionary<string, int>
        {
            { "ChromaDB", 8000 },
            { "Chroma Service", 9000 },
            { "LM Studio", 1234 },
            { "Asistente WebAPI", 5000 },
            { "Kokoro TTS", 8880 }
        };

        foreach (var servicio in servicios)
        {
            await ValidarPuerto("localhost", servicio.Value, servicio.Key);
        }

        Console.WriteLine("\n=== VALIDACIÓN DE CONECTIVIDAD COMPLETADA ===\n");
    }

    private static async Task ValidarPuerto(string host, int puerto, string nombreServicio)
    {
        try
        {
            using var tcpClient = new System.Net.Sockets.TcpClient();
            var conectTask = tcpClient.ConnectAsync(host, puerto);
            var timeoutTask = Task.Delay(5000); // 5 segundos timeout

            var completedTask = await Task.WhenAny(conectTask, timeoutTask);

            if (completedTask == conectTask && tcpClient.Connected)
            {
                Console.WriteLine($"{nombreServicio} (puerto {puerto}): CONECTADO");
                tcpClient.Close();
            }
            else if (completedTask == timeoutTask)
            {
                Console.WriteLine($"{nombreServicio} (puerto {puerto}): TIMEOUT");
            }
            else
            {
                Console.WriteLine($"{nombreServicio} (puerto {puerto}): NO DISPONIBLE");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"{nombreServicio} (puerto {puerto}): ERROR - {ex.Message}");
        }
    }

    public static async Task ValidarDNS()
    {
        Console.WriteLine("=== VALIDACIÓN DNS ===");
        try
        {
            var hostEntry = await Dns.GetHostEntryAsync("localhost");
            Console.WriteLine($"DNS localhost resuelve a: {string.Join(", ", hostEntry.AddressList.Select(ip => ip.ToString()))}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error DNS: {ex.Message}");
        }
        Console.WriteLine();
    }
}
