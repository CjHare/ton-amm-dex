import { UIProvider } from '@ton/blueprint'
import { Address } from '@ton/core'

export const defaultJettonKeys = [
    'uri',
    'name',
    'description',
    'image',
    'image_data',
    'symbol',
    'decimals',
    'amount_style',
]
export const defaultNftKeys = ['uri', 'name', 'description', 'image', 'image_data']

export const promptBool = async (
    prompt: string,
    options: [string, string],
    ui: UIProvider,
    choice: boolean = false,
) => {
    let yes = false
    let no = false
    let opts = options.map((o) => o.toLowerCase())

    do {
        let res = (
            choice
                ? await ui.choose(prompt, options, (c: string) => c)
                : await ui.input(`${prompt}(${options[0]}/${options[1]})`)
        ).toLowerCase()
        yes = res == opts[0]
        if (!yes) no = res == opts[1]
    } while (!(yes || no))

    return yes
}

export const promptAddress = async (prompt: string, ui: UIProvider, fallback?: Address): Promise<Address> => {
    let promptFinal = fallback ? prompt.replace(/:$/, '') + `(default:${fallback}):` : prompt
    do {
        let testAddr = (await ui.input(promptFinal)).replace(/^\s+|\s+$/g, '')
        try {
            return testAddr == '' && fallback ? fallback : Address.parse(testAddr)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            ui.write(`${testAddr} is not valid!\n`)
            prompt = 'Please try again:'
        }
        // eslint-disable-next-line no-constant-condition
    } while (true)
}

export const promptAmount = async (prompt: string, ui: UIProvider): Promise<string> => {
    let resAmount: number
    do {
        let inputAmount = await ui.input(prompt)
        resAmount = Number(inputAmount)
        if (isNaN(resAmount)) {
            ui.write(`Failed to convert ${inputAmount} to float number`)
        } else {
            if (resAmount < 0) {
                ui.write(`${inputAmount} must be greater than, or equal to zero`)
            } else {
                return resAmount.toFixed(9)
            }
        }
        // eslint-disable-next-line no-constant-condition
    } while (true)
}

export const promptAmountUint = async (prompt: string, ui: UIProvider): Promise<bigint> => {
    let resAmount: number
    do {
        let inputAmount = await ui.input(prompt)
        resAmount = Number(inputAmount)
        if (isNaN(resAmount)) {
            ui.write(`Failed to convert ${inputAmount} to float number`)
        } else {
            if (resAmount < 0) {
                ui.write(`${resAmount} must be greater than, or equal to zero`)
            } else {
                if (!Number.isInteger(resAmount)) {
                    console.warn(
                        `Warning: ${resAmount} is a floating-point number. It will be truncated to an integer.`,
                    )
                }
                return BigInt(Math.trunc(resAmount))
            }
        }
        // eslint-disable-next-line no-constant-condition
    } while (true)
}

export const promptUrl = async (prompt: string, ui: UIProvider) => {
    let retry = false
    let input = ''
    let res = ''

    do {
        input = await ui.input(prompt)
        try {
            let testUrl = new URL(input)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            res = testUrl.toString()
            retry = false
        } catch (e) {
            ui.write(input + " doesn't look like a valid url:\n" + e)
            retry = !(await promptBool('Use anyway?(y/n)', ['y', 'n'], ui))
        }
    } while (retry)
    return input
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cliPrettify(_: string, value: any): string {
    return prettifyWhenAddress(prettifyArray(prettifyBigInt(value)))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prettifyBigInt(value: any): string {
    if (typeof value === 'bigint') {
        return value.toString()
    }
    return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prettifyArray(value: any): string {
    // Convert the array to a string (removes the indentation)
    if (Array.isArray(value)) {
        return JSON.stringify(value)
    }
    return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prettifyWhenAddress(value: any): string {
    if (value instanceof Address) {
        return value.toString()
    }
    return value
}

export async function confirmAndProceedOrExit(ui: UIProvider) {
    const confirmation = await promptBool('Procced?', ['yes', 'no'], ui)

    if (confirmation) {
        ui.write('Proceeding...')
        ui.write('\n')
    } else {
        ui.write('Stopped')
        process.exit()
    }
}
