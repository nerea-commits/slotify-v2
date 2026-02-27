// lib/fiabilidad.ts
// ═══════════════════════════════════════════════════
// SISTEMA DE FIABILIDAD v2 — Puntos de riesgo (90 días)
// ═══════════════════════════════════════════════════

export interface FiabilidadResult {
  riskPoints: number;
  riskLabel: 'fiable' | 'atencion' | 'riesgo' | 'nuevo';
  riskColor: string;
  displayLabel: string;

  // Backward compat (calendar, modal)
  score: number;
  label: string;
  color: string;
  alertLevel: 'none' | 'info' | 'warn' | 'danger';
  alertMessage: string | null;

  // Counts (all-time)
  totalCitas: number;
  completadas: number;
  noShowsReales: number;
  noShowsJustificados: number;
  cancelacionesTardias: number;
  cancelacionesAnticipadas: number;
  reprogramadas: number;

  // Legacy compat
  cancelaciones: number;
  noShows: number;
  noShowRatio: number;
  cancelRatio: number;
}

/**
 * Infiere estado_detallado desde estado si no existe
 */
export function inferEstadoDetallado(cita: any): string {
  if (cita.estado_detallado) return cita.estado_detallado;
  const e = (cita.estado || '').toLowerCase().trim();
  if (e === 'no-show' || e === 'no_show') return 'no_show_real';
  if (e === 'cancelada') return 'cancelacion_anticipada';
  return 'completada';
}

/**
 * SISTEMA DE PUNTOS (ventana 90 días):
 *   No-show real:          +3
 *   Cancelación tardía:    +1.5
 *   No-show justificado:   +0.5
 *   Cancelación anticipada: 0
 *   Reprogramada:           0
 *   Completada:            -0.5
 *
 * Resultado:
 *   0-2  → 🟢 Fiable
 *   2-5  → 🟡 Atención
 *   5+   → 🔴 Riesgo
 *   <3 citas → ⚫ Nuevo
 */
export function calcularFiabilidad(citas: any[]): FiabilidadResult {
  const empty: FiabilidadResult = {
    riskPoints: 0, riskLabel: 'nuevo', riskColor: '#6B7280',
    displayLabel: 'Nuevo', score: 100, label: 'Nuevo', color: '#6B7280',
    alertLevel: 'none', alertMessage: null,
    totalCitas: 0, completadas: 0,
    noShowsReales: 0, noShowsJustificados: 0,
    cancelacionesTardias: 0, cancelacionesAnticipadas: 0, reprogramadas: 0,
    cancelaciones: 0, noShows: 0, noShowRatio: 0, cancelRatio: 0,
  };

  if (!citas || citas.length === 0) return empty;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 90 * 86400000);

  // All-time counts
  let comp = 0, nsReal = 0, nsJust = 0, cTardia = 0, cAntic = 0, reprog = 0;
  let riskPoints = 0;

  citas.forEach(cita => {
    const ed = inferEstadoDetallado(cita);
    const d = cita.hora_inicio ? new Date(cita.hora_inicio) : null;
    const inW = d ? d >= windowStart : false;

    switch (ed) {
      case 'completada':
        comp++;
        if (inW) riskPoints -= 0.5;
        break;
      case 'no_show_real':
        nsReal++;
        if (inW) riskPoints += 3;
        break;
      case 'no_show_justificado':
        nsJust++;
        if (inW) riskPoints += 0.5;
        break;
      case 'cancelacion_tardia':
        cTardia++;
        if (inW) riskPoints += 1.5;
        break;
      case 'cancelacion_anticipada':
        cAntic++;
        break;
      case 'reprogramada':
        reprog++;
        break;
      default:
        comp++;
        break;
    }
  });

  riskPoints = Math.max(0, riskPoints);
  const total = citas.length;
  const allNS = nsReal + nsJust;
  const allCancel = cTardia + cAntic;

  let riskLabel: 'fiable' | 'atencion' | 'riesgo' | 'nuevo';
  let displayLabel: string;
  let riskColor: string;
  let alertLevel: 'none' | 'info' | 'warn' | 'danger';
  let alertMessage: string | null = null;

  if (total < 3) {
    riskLabel = 'nuevo';
    displayLabel = 'Nuevo';
    riskColor = '#6B7280';
    if (nsReal > 0) {
      alertLevel = 'warn';
      alertMessage = `Este cliente tiene ${nsReal} no-show sin justificar.`;
    } else {
      alertLevel = 'none';
    }
  } else if (riskPoints >= 5) {
    riskLabel = 'riesgo';
    displayLabel = 'Riesgo';
    riskColor = '#EF4444';
    alertLevel = 'danger';
    const parts: string[] = [];
    if (nsReal > 0) parts.push(`${nsReal} no-show${nsReal !== 1 ? 's' : ''} reales`);
    if (cTardia > 0) parts.push(`${cTardia} cancelación${cTardia !== 1 ? 'es' : ''} tardía${cTardia !== 1 ? 's' : ''}`);
    alertMessage = parts.length > 0 ? parts.join(' y ') + '.' : 'Patrón de incidencias recurrente.';
  } else if (riskPoints >= 2) {
    riskLabel = 'atencion';
    displayLabel = 'Atención';
    riskColor = '#F59E0B';
    alertLevel = 'warn';
    const parts: string[] = [];
    if (nsReal > 0) parts.push(`${nsReal} no-show${nsReal !== 1 ? 's' : ''}`);
    if (cTardia > 0) parts.push(`${cTardia} cancelación${cTardia !== 1 ? 'es' : ''} tardía${cTardia !== 1 ? 's' : ''}`);
    alertMessage = parts.length > 0 ? parts.join(' y ') + '.' : null;
  } else {
    riskLabel = 'fiable';
    displayLabel = 'Fiable';
    riskColor = '#10B981';
    // Alert from first no-show ever
    if (nsReal > 0) {
      alertLevel = 'info';
      alertMessage = `Este cliente tiene ${nsReal} no-show registrado${nsReal !== 1 ? 's' : ''}.`;
    } else {
      alertLevel = 'none';
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - riskPoints * 10)));

  return {
    riskPoints, riskLabel, riskColor, displayLabel,
    score, label: displayLabel, color: riskColor,
    alertLevel, alertMessage,
    totalCitas: total, completadas: comp,
    noShowsReales: nsReal, noShowsJustificados: nsJust,
    cancelacionesTardias: cTardia, cancelacionesAnticipadas: cAntic,
    reprogramadas: reprog,
    cancelaciones: allCancel, noShows: allNS,
    noShowRatio: total > 0 ? allNS / total : 0,
    cancelRatio: total > 0 ? allCancel / total : 0,
  };
}

export function getRiskIndicator(fiabilidad: FiabilidadResult): { show: boolean; color: string; icon: string | null } {
  // Show warning from first no-show real, anywhere
  if (fiabilidad.noShowsReales > 0) {
    if (fiabilidad.riskLabel === 'riesgo') return { show: true, color: '#EF4444', icon: '🔴' };
    return { show: true, color: '#F59E0B', icon: '⚠' };
  }
  if (fiabilidad.riskLabel === 'atencion') return { show: true, color: '#F59E0B', icon: '⚠' };
  if (fiabilidad.riskLabel === 'riesgo') return { show: true, color: '#EF4444', icon: '🔴' };
  return { show: false, color: 'transparent', icon: null };
}
