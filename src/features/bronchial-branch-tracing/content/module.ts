/** Where the module lives and the texts it is built on. */
export const BASE_PATH = '/learn/anatomy/branch-tracing'
/** The scope's roll at each fork, the airway names and the subsegment letters. */
export const SOURCE = {
  title: 'Kurimoto & Morita. Bronchial Branch Tracing (2020)',
  url: 'https://doi.org/10.1007/978-981-13-9905-3',
}
/** The method the course teaches: planning from the lesion and the nested-arc map. */
export const METHOD_SOURCE = {
  title:
    'Mortimer & Saghaie. Lost in navigation: a simplified CT-based airway mapping method for ultrathin navigational bronchoscopy. J Clin Med 2025;14:8009',
  url: 'https://doi.org/10.3390/jcm14228009',
}
export const lessonHref = (id: string) => `${BASE_PATH}/learn?lesson=${id}`
