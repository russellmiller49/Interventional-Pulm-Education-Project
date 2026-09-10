import { describe, expect, it } from 'vitest';

import { knobologyContent } from '@/content/knobology';
import { getStationMapContent, getStations } from '@/content/stations';
import {
  getLocalizedKnobologyContent,
  getLocalizedKnobologyQuizQuestions,
  getLocalizedStationMapContent,
  getLocalizedStations,
} from '@/i18n/localizedContent';

describe('localized body content overlays', () => {
  it('localizes knobology body copy while preserving exercise IDs and control targets', () => {
    const localizedKnobology = getLocalizedKnobologyContent('es');

    expect(localizedKnobology.primerSections[0]?.id).toBe(knobologyContent.primerSections[0]?.id);
    expect(localizedKnobology.primerSections[0]?.title).not.toBe(knobologyContent.primerSections[0]?.title);
    expect(localizedKnobology.controlLabExercises[0]?.id).toBe(knobologyContent.controlLabExercises[0]?.id);
    expect(localizedKnobology.controlLabExercises[0]?.focusControl).toBe(knobologyContent.controlLabExercises[0]?.focusControl);
    expect(localizedKnobology.controlLabExercises[0]?.target).toEqual(knobologyContent.controlLabExercises[0]?.target);
  });

  it('localizes module quiz prompts while preserving quiz IDs and scoring keys', () => {
    const localizedQuestions = getLocalizedKnobologyQuizQuestions('zh-CN');
    const sourceQuestion = getLocalizedKnobologyQuizQuestions('en')[0];
    const localizedQuestion = localizedQuestions[0];

    expect(localizedQuestion?.id).toBe(sourceQuestion?.id);
    expect(localizedQuestion?.moduleId).toBe(sourceQuestion?.moduleId);
    expect(localizedQuestion?.correctOptionIds).toEqual(sourceQuestion?.correctOptionIds);
    expect(localizedQuestion?.prompt).not.toBe(sourceQuestion?.prompt);
  });

  it('localizes station content while preserving station IDs, zone logic, and access enums', () => {
    const sourceStation = getStations().find((station) => station.id === '2R');
    const localizedStation = getLocalizedStations('es').find((station) => station.id === '2R');

    expect(sourceStation).toBeDefined();
    expect(localizedStation).toBeDefined();
    expect(localizedStation?.id).toBe(sourceStation?.id);
    expect(localizedStation?.zone).toBe(sourceStation?.zone);
    expect(localizedStation?.zoneKey).toBe(sourceStation?.zoneKey);
    expect(localizedStation?.accessProfile).toBe(sourceStation?.accessProfile);
    expect(localizedStation?.relatedStationIds).toEqual(sourceStation?.relatedStationIds);
    expect(localizedStation?.displayName).not.toBe(sourceStation?.displayName);
  });

  it('localizes station map quiz prompts without changing station answer IDs', () => {
    const sourceRound = getStationMapContent().quizRounds[0];
    const localizedRound = getLocalizedStationMapContent('es').quizRounds[0];

    expect(localizedRound?.id).toBe(sourceRound?.id);
    expect(localizedRound?.stationId).toBe(sourceRound?.stationId);
    expect(localizedRound?.prompt).not.toBe(sourceRound?.prompt);
  });
});
