# Test audit compute services
$services = @("ec2", "lambda", "ecs", "eks", "lightsail", "beanstalk", "batch")
$body = @{ services = $services } | ConvertTo-Json

Write-Host "Testing compute services audit..."
Write-Host "Services: $($services -join ', ')"

# Get credentials from sessionStorage would require browser - using test only
$headers = @{
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/services" -Method GET
    Write-Host "`nAvailable compute services:"
    $response.data.services | Where-Object { $_.category -eq "compute" } | ForEach-Object {
        Write-Host "  - $($_.id): $($_.name)"
    }
} catch {
    Write-Host "Error: $_"
}
