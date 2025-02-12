using System.Net.Mime;
using Microsoft.AspNetCore.Mvc;

namespace TotalStalker;

[ApiController]
[Route("api/[controller]")]
public class PingController : ControllerBase
{
    private readonly ILogger<PingController> _logger;

    public PingController(ILogger<PingController> logger)
    {
        _logger = logger;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [Produces(MediaTypeNames.Text.Plain)]
    public IActionResult Get()
    {
        _logger.LogDebug(nameof(Get));
        return Ok("pong");
    }
}
