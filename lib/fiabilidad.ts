// lib/fiabilidad.ts
// ═══════════════════════════════════════════════════
// SISTEMA DE FIABILIDAD DEL CLIENTE
// Usado en: ClientesSection, NuevaCitaModal, Calendar
// ═══════════════════════════════════════════════════

export interface FiabilidadResult {
  score: number;           // 0-100
  label: string;           // 'Excelente' | 'Buena' | 'Regular' | 'Baja' | 'Nuevo'
  color: string;           // hex color
  alertLevel: 'none' | 'info' | 'warn' | 'danger';
  alertMessage: string | null;
  totalCitas: number;
  completadas: number;
  cancelaciones: number;
  noShows: number;
  noShowRatio: number;     // 0-1
  cancelRatio: number;     // 0-1
}

/**
 * FÓRMULA DE FIABILIDAD
 * 
 * Base: 100 puntos
 * - No-shows:      -60 × (no_shows / total)   → Peso fuerte (no avisar es grave)
 * - Cancelaciones:  -20 × (cancel / total)     → Peso menor (cancelar es aceptable)
 * 
 * Atenuación por muestra pequeña:
 * - Si < 5 citas, atenúa la penalización proporcionalmente
 * - Evita que 1 no-show en 1 cita = 40% fiabilidad
 * - Con 1 no-show de 2 citas → ~82% (no 70%)
 * 
 * Resultado:
 * - ≥85 → Excelente (verde)     → Sin alerta
 * - ≥70 → Buena (verde claro)   → Info si hay algún no-show
 * - ≥50 → Regular (ámbar)       → Advertencia
 * - <50 → Baja (rojo)           → Riesgo alto
 * - <3 citas → "Nuevo" (gris)   → Sin datos suficientes
 */
export function calcularFiabilidad(citas: any[]): FiabilidadResult {
  if (!citas || citas.length === 0) {
    return {
      score: 100, label: 'Nuevo', color: '#6B7280',
      alertLevel: 'none', alertMessage: null,
      totalCitas: 0, completadas: 0, cancelaciones: 0, noShows: 0,
      noShowRatio: 0, cancelRatio: 0,
    };
  }

  const total = citas.length;
  const cancelaciones = citas.filter(c => c.estado === 'cancelada').length;
  const noShows = citas.filter(c => c.estado === 'no-show' || c.estado === 'no_show' || c.estado === 'No-show').length;
  const completadas = total - cancelaciones - noShows;

  const noShowRatio = total > 0 ? noShows / total : 0;
  const cancelRatio = total > 0 ? cancelaciones / total : 0;

  // Penalización cruda
  const rawPenalty = (noShowRatio * 60) + (cancelRatio * 20);

  // Atenuación si muestra es pequeña (< 5 citas)
  const dampenFactor = Math.min(1, total / 5);
  const adjustedPenalty = rawPenalty * dampenFactor;

  let score = Math.round(Math.max(0, Math.min(100, 100 - adjustedPenalty)));

  // Si menos de 3 citas, mostrar como "Nuevo"
  if (total < 3) {
    return {
      score, label: 'Nuevo', color: '#6B7280',
      alertLevel: noShows > 0 ? 'info' : 'none',
      alertMessage: noShows > 0 ? `Este cliente tuvo ${noShows} no-show en sus primeras citas.` : null,
      totalCitas: total, completadas, cancelaciones, noShows,
      noShowRatio, cancelRatio,
    };
  }

  // Determinar nivel
  let label: string;
  let color: string;
  let alertLevel: 'none' | 'info' | 'warn' | 'danger';
  let alertMessage: string | null = null;

  if (score >= 85) {
    label = 'Excelente';
    color = '#10B981';
    alertLevel = noShows > 0 ? 'info' : 'none';
    if (noShows > 0) {
      alertMessage = `Este cliente tuvo ${noShows} no-show anteriormente.`;
    }
  } else if (score >= 70) {
    label = 'Buena';
    color = '#22C55E';
    alertLevel = 'info';
    alertMessage = `Tiene ${noShows} no-show${noShows !== 1 ? 's' : ''} de ${total} citas (${Math.round(noShowRatio * 100)}%).`;
  } else if (score >= 50) {
    label = 'Regular';
    color = '#F59E0B';
    alertLevel = 'warn';
    alertMessage = `Tiene ${noShows} no-show${noShows !== 1 ? 's' : ''} previos. Considera confirmar la cita.`;
  } else {
    label = 'Baja';
    color = '#EF4444';
    alertLevel = 'danger';
    const pct = Math.round(noShowRatio * 100);
    alertMessage = `Cliente con alto índice de ausencia (${pct}% no-show). Considera solicitar señal.`;
  }

  return {
    score, label, color, alertLevel, alertMessage,
    totalCitas: total, completadas, cancelaciones, noShows,
    noShowRatio, cancelRatio,
  };
}

/**
 * Determina si debe mostrarse indicador de riesgo en el calendario
 * Solo para fiabilidad < 70 (Regular o Baja)
 * Retorna null si no hay riesgo, o el color del indicador
 */
export function getRiskIndicator(fiabilidad: FiabilidadResult): { show: boolean; color: string; icon: '⚠' | '🔴' | null } {
  if (fiabilidad.label === 'Nuevo' || fiabilidad.score >= 70) {
    return { show: false, color: 'transparent', icon: null };
  }
  if (fiabilidad.score >= 50) {
    return { show: true, color: '#F59E0B', icon: '⚠' }; // Ámbar
  }
  return { show: true, color: '#EF4444', icon: '🔴' }; // Rojo
}
