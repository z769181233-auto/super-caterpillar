echo "Checking Health..."
curl -v http://localhost:3000/health
echo "\nChecking Ready..."
curl -v http://localhost:3000/health/ready
echo "\nChecking Metrics..."
curl -v http://localhost:3000/metrics

echo "\nChecking Debug Key..."
curl -v "http://localhost:3000/api/debug-key/scu_smoke_key"
