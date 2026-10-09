/**
 * Cessna 172 (Skyhawk) checklists for Sitka Flight Simulator.
 *
 * Three phases: pre-flight, takeoff, landing.
 * Each item has a short label and a detail line.
 * The UI requires press-and-hold (500ms) to confirm — the ritual rule.
 */

export const CHECKLISTS = {
  preflight: {
    id: 'preflight',
    title: 'PRE-FLIGHT',
    subtitle: 'C172 · N172SP · Sitka Ramp',
    items: [
      { id: 'docs', label: 'Documents', detail: 'ARROW — airworthiness, registration, radio license, ops limits, weight & balance' },
      { id: 'fuel', label: 'Fuel & Oil', detail: '53 gal usable · 8 qt oil · sump drains clear' },
      { id: 'controls', label: 'Control Surfaces', detail: 'Ailerons, elevator, rudder — free and correct' },
      { id: 'gear', label: 'Landing Gear', detail: 'Tires, brakes, struts — no leaks, chocks removed' },
      { id: 'prop', label: 'Propeller & Spinner', detail: 'No nicks, cracks, or spinner damage' },
      { id: 'engine', label: 'Engine & Cowling', detail: 'Secure, no leaks, exhaust intact' },
      { id: 'pitot', label: 'Pitot-Static', detail: 'Pitot cover removed, static ports clear, fuel vents open' },
      { id: 'lights', label: 'Lights & Avionics', detail: 'Beacon on, nav lights, panel — master on, check, master off' },
    ],
  },
  takeoff: {
    id: 'takeoff',
    title: 'TAKEOFF',
    subtitle: 'Runway 11 · Sitka (PASI)',
    items: [
      { id: 'flaps', label: 'Flaps', detail: 'Set 0° (normal) or 10° (short/soft field)' },
      { id: 'trim', label: 'Trim', detail: 'Takeoff setting — neutral' },
      { id: 'xpdr', label: 'Transponder', detail: 'ALT mode, squawk 1200' },
      { id: 'runway', label: 'Runway Clear', detail: 'Final approach clear, runway 11 verified' },
      { id: 'power', label: 'Full Power', detail: 'Throttle full, RPM 2300+, engine instruments green' },
    ],
  },
  landing: {
    id: 'landing',
    title: 'LANDING',
    subtitle: 'Final approach',
    items: [
      { id: 'fuel-l', label: 'Fuel', detail: 'Both tanks, sufficient for go-around' },
      { id: 'mixture', label: 'Mixture', detail: 'Rich (or as required by altitude)' },
      { id: 'ldg-light', label: 'Landing Light', detail: 'On' },
      { id: 'flaps-l', label: 'Flaps', detail: 'Full 30° on final' },
      { id: 'speed', label: 'Airspeed', detail: '65 KIAS on final, 60 over the threshold' },
    ],
  },
};

/** Phase order for the full flow. */
export const PHASE_ORDER = ['preflight', 'takeoff', 'landing'];
