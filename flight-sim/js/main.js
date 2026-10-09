/**
 * Sitka Flight Simulator — main entry (Phase 1).
 *
 * Boots a 3D scene over Sitka terrain with the checklist system.
 * Phase 1 scope: checklist prototype + scene. No ATC, no missions yet.
 */

import { ChecklistPanel } from './ui/ChecklistPanel.js';
import { CHECKLISTS, PHASE_ORDER } from './checklists/c172.js';

const $ = (id) => document.getElementById(id);

let checklistPanel = null;
let currentPhaseIdx = 0;

function setBanner(html) {
  $('phase-banner').innerHTML = html;
}

function advancePhase() {
  currentPhaseIdx++;
  if (currentPhaseIdx < PHASE_ORDER.length) {
    const next = PHASE_ORDER[currentPhaseIdx];
    checklistPanel.show(next);
    setBanner(`Checklist: <b>${CHECKLISTS[next].title}</b>`);
  } else {
    checklistPanel.hide();
    $('checklist-btn').style.display = 'none';
    setBanner(`<span class="go">✓ All checklists complete — cleared for takeoff</span>`);
  }
}

function boot() {
  // Checklist panel mounts into #ui-root (slides in from left)
  checklistPanel = new ChecklistPanel($('ui-root'), CHECKLISTS);
  checklistPanel.onPhaseComplete = (phaseId) => {
    // MiniMax: auto-advance to maintain workflow momentum — pilots are
    // already heads-down, don't make them tap to continue the ritual.
    setTimeout(() => advancePhase(), 900);
  };

  $('checklist-btn').addEventListener('click', () => {
    const panel = document.querySelector('.checklist-panel');
    if (panel.classList.contains('visible')) {
      checklistPanel.hide();
    } else {
      // Show current incomplete phase, or first phase
      let phaseToShow = PHASE_ORDER[currentPhaseIdx];
      if (checklistPanel.isPhaseComplete(phaseToShow)) advancePhase();
      else checklistPanel.show(phaseToShow);
    }
  });

  $('checklist-btn').addEventListener('dblclick', advancePhase);

  // Auto-open pre-flight on boot — the ritual starts immediately
  setTimeout(() => {
    checklistPanel.show('preflight');
    setBanner(`Checklist: <b>PRE-FLIGHT</b> — press &amp; hold each item`);
  }, 800);

  // TODO Phase 2: terrain, sky, aircraft, ATC, missions
  // For now, the gradient background stands in for the sky.
  console.log('[Sitka Flight Sim] Phase 1 boot — checklist prototype ready');
}

document.addEventListener('DOMContentLoaded', boot);
