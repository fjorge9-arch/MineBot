const fs   = require('fs')
const path = require('path')

function cameraOrientation(yaw, pitch) {
    const y = (yaw   * Math.PI) / 180
    const p = (pitch * Math.PI) / 180
    return {
        x: -Math.sin(y) * Math.cos(p),
        y: -Math.sin(p),
        z:  Math.cos(y) * Math.cos(p)
    }
}

function distance2D(x1, z1, x2, z2) {
    const dx = x2 - x1
    const dz = z2 - z1
    return Math.sqrt(dx * dx + dz * dz)
}

// Returns full path of the newest file in dir that matches filter, or null.
function getNewestFile(dir, filter) {
    const files = fs.readdirSync(dir)
        .filter(filter)
        .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t)
    return files.length ? path.join(dir, files[0].f) : null
}

module.exports = { cameraOrientation, distance2D, getNewestFile }
