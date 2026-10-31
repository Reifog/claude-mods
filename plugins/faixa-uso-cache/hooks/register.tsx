import { atom, read, update } from 'claude-code'
import type { Register, SessionRateLimit, EngineInterface } from 'claude-code'

import type { Semana } from '../types'


const ultimaAtividade = atom({ plugin: 'faixa-uso-cache', key: 'ultimaAtividade' } as const, null)
const agora = atom({ plugin: 'faixa-uso-cache', key: 'agora' } as const, 0)
const semana = atom({ plugin: 'faixa-uso-cache', key: 'semana' } as const, null)

const HORA = 60 * 60 * 1000

function semanal(limits: SessionRateLimit[]): Semana | null {
  const w = limits.find(l => l.kind === 'seven_day')
  return w ? { percentUsed: w.percentUsed, resetsAt: w.resetsAt } : null
}

function quandoRenova(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return ` (renova ${dias[d.getDay()]} ${hh}:${mm})`
}

async function marcar($: EngineInterface) {
  const t = await $.clock.now()
  await update($, ultimaAtividade, () => t)
  await update($, agora, () => t)
}

export const register: Register = on => {
  let parar: unknown

  on('session.start', async ($, e, next) => {
    const r = await next(e)
    const t = await $.clock.now()
    await update($, agora, () => t)
    try {
      const u = await $.session.usage()
      const s = semanal(u.rateLimits)
      if (s) await update($, semana, () => s)
    } catch {}
    if (!parar) {
      parar = $.clock.every(60_000, async () => {
        const n = await $.clock.now()
        await update($, agora, () => n)
      })
    }
    return r
  })

  on('session.measure', async ($, e, next) => {
    const s = semanal(e.rateLimits)
    if (s) await update($, semana, () => s)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await marcar($)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await marcar($)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text } = $.ui.resolve(e)

    const ultima = await read($, ultimaAtividade)
    const n = Math.max(await read($, agora), ultima ?? 0)
    const s = await read($, semana)

    const textoSemana = s
      ? `Semana: resta ${Math.max(0, Math.round(100 - s.percentUsed))}%${quandoRenova(s.resetsAt)}`
      : 'Semana: sem leitura do uso ainda'

    const frio = !e.props.isWorking && ultima !== null && n - ultima >= HORA

    if (frio) {
      return (
        <Box backgroundColor="red" paddingX={1}>
          <Text color="white" bold>
            Cache Frio, a proxima mensagem relê tudo · {textoSemana}
          </Text>
        </Box>
      )
    }

    let textoCache: string
    if (e.props.isWorking) textoCache = 'Cache quente'
    else if (ultima === null) textoCache = 'Cache: nenhuma mensagem ainda'
    else {
      const resta = Math.max(1, Math.ceil((HORA - (n - ultima)) / 60_000))
      textoCache = `Cache quente (esfria em ${resta} min)`
    }

    return (
      <Box paddingX={1}>
        <Text color="green">{textoCache}</Text>
        <Text dimColor> · {textoSemana}</Text>
      </Box>
    )
  })
}
