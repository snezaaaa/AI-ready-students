import React from 'react';
import PromptBuilderBase from '../../ui/PromptBuilderBase.jsx';
import { SLOTS, CARDS, isCardAvailable, assemblePrompt } from './promptPuzzle.js';
import { testPrompt, startDoorSequence } from './logic.js';

export default function PromptBuilder() {
  return (
    <PromptBuilderBase
      title="GRADITELJ PROMPTA" tag="// PROMPTOTRON 3000"
      subtitle="Izaberi po jednu karticu za svaki dio. Kartice koje sijaju pronađene su u učionici. Ostale su došle uz program. (Sumnjivo.)"
      slots={SLOTS} cards={CARDS}
      isAvailable={isCardAvailable}
      lockedText={(slot) => `Još nije pronađeno — potraži dio ${slot.label} u učionici`}
      assemble={assemblePrompt}
      onTest={testPrompt} onSuccess={startDoorSequence}
      thinkingLabel="PROMPTOTRON RAZMIŠLJA…" successFoot="Otključavam vrata…"
    />
  );
}
