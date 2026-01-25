#!/usr/bin/env node
/**
 * Get local network IP address
 * Usage: node get-local-ip.js
 */

const os = require('os');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push({
                    interface: name,
                    address: iface.address
                });
            }
        }
    }
    
    return ips;
}

const ips = getLocalIP();

if (ips.length === 0) {
    console.log('No local network IP found. Make sure you are connected to a network.');
    process.exit(1);
}

console.log('\n📍 Local Network IP Addresses:');
console.log('─'.repeat(50));
ips.forEach(({ interface: name, address }) => {
    console.log(`  ${name.padEnd(15)} → ${address}`);
});

const primaryIP = ips[0].address;
console.log('\n💡 Use this IP for frontend configuration:');
console.log(`   REACT_APP_API_URL=http://${primaryIP}:3001/api\n`);
