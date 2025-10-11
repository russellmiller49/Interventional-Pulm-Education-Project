export interface CurriculumSection {
  id: string
  title: string
  body: string
}

export interface CurriculumMonth {
  month: number
  title: string
  description: string
  sections: CurriculumSection[]
}

