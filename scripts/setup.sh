set -e

if [ ! -d "node_modules" ]; then
    npm install
fi

pkill -f "hardhat node" 2>/dev/null || true
sleep 2

npx hardhat clean
npx hardhat compile

npx hardhat node > hardhat.log 2>&1 &
pid=$!
sleep 5

npx hardhat run scripts/deploy-secure.js --network localhost

if [ $? -eq 0 ]; then
    echo $pid > .hardhat.pid
    echo "Setup complete. Run: npm run dev"
else
    kill $pid 2>/dev/null || true
    exit 1
fi
