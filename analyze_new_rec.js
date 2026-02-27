const fs = require('fs')
const readline = require('readline')

async function findMovementInSpecificFile() {
    // A gravação nova identificada pela análise anterior
    const filePath = 'recordings/session-2026-02-14T01-41-26-040Z.jsonl'

    if (!fs.existsSync(filePath)) {
        console.error(`Arquivo não encontrado: ${filePath}`)
        return
    }

    const fileStream = fs.createReadStream(filePath)
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    let firstPacketTime = null
    let firstMovementTime = null
    let firstJumpTime = null
    let lineCount = 0

    for await (const line of rl) {
        if (!line.trim()) continue
        lineCount++

        try {
            const record = JSON.parse(line)

            if (record.dir === 'C2S') {
                if (!firstPacketTime) {
                    firstPacketTime = record.ts
                }

                if (record.name === 'player_auth_input') {
                    const params = record.params

                    // Detectar movimento
                    if (!firstMovementTime && params.move_vector && (params.move_vector.x !== 0 || params.move_vector.z !== 0)) {
                        firstMovementTime = record.ts
                        console.log(`[Análise] Primeiro movimento (andar) detectado aos ${((firstMovementTime - firstPacketTime) / 1000).toFixed(2)}s (Linha ${lineCount})`)
                    }

                    // Detectar pulo
                    if (!firstJumpTime && params.input_data) {
                        // Verificando se é BigInt ou Object (depende de como foi gravado)
                        let isJumping = false
                        const inputData = params.input_data

                        if (typeof inputData === 'object') {
                            isJumping = inputData.jumping === true || inputData.start_jumping === true
                        } else if (typeof inputData === 'string' || typeof inputData === 'bigint') {
                            const val = BigInt(inputData.toString())
                            // No Bedrock, jumping costuma ser o bit 3 (valor 4) ou 1048576n etc. 
                            // Mas se o proxy gravou o objeto, é mais fácil.
                        }

                        if (isJumping) {
                            firstJumpTime = record.ts
                            console.log(`[Análise] Primeiro pulo detectado aos ${((firstJumpTime - firstPacketTime) / 1000).toFixed(2)}s (Linha ${lineCount})`)
                        }
                    }
                }
            }
        } catch (e) { }
    }

    if (!firstMovementTime && !firstJumpTime) {
        console.log('❌ Nenhum movimento ou pulo encontrado nesta gravação.')
    }
}

findMovementInSpecificFile()
