#!/usr/bin/env node
/**
 * Teste automatizado de todos os bots do archive
 * Executa cada bot ATÉ TERMINAR (sem timeout)
 */

const { spawn } = require('child_process')
const path = require('path')

// Bots que são clientes (não proxies/analyzers)
const BOTS_TO_TEST = [
    'archive/auto_bot.js',
    'archive/clone_bot.js',
    'archive/head_bot.js',
    'archive/patient_bot.js',
    'archive/perfect_bot.js',
    'archive/physics_bot.js',
    'archive/spin_bot.js',
    'archive/test_simple_bot.js',
    'archive/test_walk_bot.js',
    'archive/timing_bot.js',
    'archive/walking_bot.js',
    'replay_bot.js'
]

async function testBot(botPath) {
    return new Promise((resolve) => {
        console.log(`\n${'='.repeat(60)}`)
        console.log(`TESTANDO: ${botPath}`)
        console.log(`(Timeout máximo: 2 minutos)`)
        console.log('='.repeat(60))
        
        const startTime = Date.now()
        const MAX_TIMEOUT = 2 * 60 * 1000 // 2 minutos máximo
        
        const child = spawn('node', [botPath], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe']
        })
        
        let output = ''
        let hasMovement = false
        let maxDistance = 0
        let finished = false
        
        // Timeout máximo
        const timeout = setTimeout(() => {
            if (!finished) {
                console.log(`\n[TIMEOUT] ${botPath} excedeu 2 minutos`)
                child.kill('SIGTERM')
            }
        }, MAX_TIMEOUT)
        
        child.stdout.on('data', (data) => {
            const text = data.toString()
            output += text
            process.stdout.write(text)
            
            // Detectar movimento
            if (text.includes('MOVIMENTO') || text.includes('Distance:')) {
                const distMatch = text.match(/Distance:\s*([\d.]+)/)
                if (distMatch) {
                    const dist = parseFloat(distMatch[1])
                    if (dist > maxDistance) maxDistance = dist
                    if (dist > 4) hasMovement = true
                }
            }
            
            // Detectar conclusão
            if (text.includes('Replay Finished') || text.includes('Teste completo') || 
                text.includes('finalizado') || text.includes('Finished')) {
                console.log(`\n[BOT TERMINOU NATURALMENTE]`)
            }
        })
        
        child.stderr.on('data', (data) => {
            process.stderr.write(data.toString())
        })
        
        child.on('exit', (code) => {
            finished = true
            clearTimeout(timeout)
            const duration = ((Date.now() - startTime) / 1000).toFixed(1)
            resolve({
                bot: botPath,
                exitCode: code,
                hasMovement,
                maxDistance,
                duration,
                output: output.slice(-500)
            })
        })
        
        child.on('error', (err) => {
            finished = true
            clearTimeout(timeout)
            resolve({
                bot: botPath,
                error: err.message,
                hasMovement: false,
                maxDistance: 0,
                duration: 0
            })
        })
    })
}

async function main() {
    console.log('=' .repeat(60))
    console.log('TESTE AUTOMATIZADO DE BOTS')
    console.log('Cada bot roda ATÉ TERMINAR naturalmente')
    console.log('='.repeat(60))
    
    const results = []
    
    for (const bot of BOTS_TO_TEST) {
        // Pausa entre testes
        await new Promise(r => setTimeout(r, 3000))
        
        try {
            const result = await testBot(bot)
            results.push(result)
            
            console.log(`\n>>> RESULTADO: ${bot}`)
            console.log(`    Duração: ${result.duration}s`)
            console.log(`    Movimento detectado: ${result.hasMovement ? 'SIM!' : 'não'}`)
            console.log(`    Distância máxima: ${result.maxDistance}`)
            
            if (result.hasMovement) {
                console.log('\n' + '!'.repeat(60))
                console.log('MOVIMENTO ENCONTRADO!')
                console.log(`Bot: ${bot}`)
                console.log('!'.repeat(60))
            }
        } catch (e) {
            console.error(`Erro ao testar ${bot}:`, e.message)
        }
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60))
    console.log('RESUMO DOS TESTES')
    console.log('='.repeat(60))
    
    const working = results.filter(r => r.hasMovement)
    
    for (const r of results) {
        const status = r.hasMovement ? '✓ MOVE' : '✗ parado'
        console.log(`${status} | ${r.bot} | dist: ${r.maxDistance} | ${r.duration}s`)
    }
    
    if (working.length > 0) {
        console.log('\n>>> BOTS QUE MOVEM:')
        working.forEach(r => console.log(`    - ${r.bot}`))
    } else {
        console.log('\nNenhum bot conseguiu mover :(')
    }
}

main().catch(console.error)
