import { expect, test, mock } from 'claude-code/testing'

const BAND = {
  plugin: 'faixa-uso-cache',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, columns: 80 },
} as any

test('quente, depois frio após 1 hora, com uso semanal', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [{ kind: 'seven_day', percentUsed: 37 }] } }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('turn.complete', (_, e) => ({ text: (e as any).answer ?? '' }) as any)

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true } as any)
  await $.turn.complete({ answer: 'oi' } as any)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Cache quente/ }))?.text).toContain('esfria em 60 min')
  expect((await ui.find({ type: 'Text', text: /Semana/ }))?.text).toContain('resta 63%')
  await ui.unmount()

  await clock.advance(61 * 60 * 1000)
  const ui2 = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui2.find({ type: 'Text', text: /Cache Frio/ }))?.text).toContain('a proxima mensagem relê tudo')
  await ui2.unmount()
})

test('sem leitura semanal, não inventa número', async ($, on) => {
  mock.clock(on, { now: 5 })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /Semana/ }))?.text).toContain('sem leitura')
  await ui.unmount()
})
