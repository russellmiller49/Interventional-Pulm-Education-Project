import { validateDolphinSection } from '../content/stageLessons'
import { toDolphinClinicalItem } from '../content/stageItems'
import { choosingTheInstrument } from '../content/sections/choosing-the-instrument'
import { beforeTheDay } from '../content/sections/before-the-day'
import { theRoomAndTheTeam } from '../content/sections/the-room-and-the-team'
import { sedationAndNumbing } from '../content/sections/sedation-and-numbing'

it.each([choosingTheInstrument, beforeTheDay, theRoomAndTheTeam, sedationAndNumbing])(
  '$id validates',
  (section) => {
    expect(validateDolphinSection(section)).toEqual([])
    toDolphinClinicalItem(section.id, section.prediction, 'predict')
    toDolphinClinicalItem(section.id, section.transfer, 'transfer')
    for (const c of section.practice) toDolphinClinicalItem(section.id, c.item, 'predict')
  },
)
