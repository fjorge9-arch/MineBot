const bedrock = require('bedrock-protocol')

const client = bedrock.createClient({
    host: '127.0.0.1',
    port: 19134, // Connect to Gateway
    username: 'TestBot',
    offline: true, // Offline mode
    skipPing: true // Try connecting directly without pinging first
})

console.log('Attempting to connect to Gateway (127.0.0.1:19134)...')

client.on('join', () => {
    console.log('✅ Success! Connected to Gateway.')
    client.close()
    process.exit(0)
})

client.on('error', (err) => {
    console.error('❌ Connection Failed:', err.message)
    process.exit(1)
})

// Timeline timeout
setTimeout(() => {
    console.log('❌ Timeout: Gateway did not respond.')
    process.exit(1)
}, 10000)
