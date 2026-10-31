export type Semana = { percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'faixa-uso-cache': {
      ultimaAtividade: number | null
      agora: number
      semana: Semana | null
    }
  }
}
