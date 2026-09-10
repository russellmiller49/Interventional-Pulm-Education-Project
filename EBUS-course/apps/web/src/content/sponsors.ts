import bostonScientificLogo from '../../../../Sponsors/Boston Scientific.png?url';
import circulogeneLogo from '../../../../Sponsors/Circulogene.png?url';
import cookMedicalLogo from '../../../../Sponsors/Cook Medical.png?url';
import erbeLogo from '../../../../Sponsors/ERBE.png?url';
import fujifilmLogo from '../../../../Sponsors/Fujifilm.png?url';
import intuitiveLogo from '../../../../Sponsors/intuitive.png?url';
import monarchLogo from '../../../../Sponsors/Monarch.png?url';
import noahLogo from '../../../../Sponsors/Noah.png?url';
import olympusLogo from '../../../../Sponsors/Olympus.png?url';
import thoracentLogo from '../../../../Sponsors/Thoracent.png?url';

import type { SponsorContent } from '@/content/types';

export const sponsors: SponsorContent[] = [
  {
    id: 'boston-scientific',
    name: 'Boston Scientific',
    logoSrc: bostonScientificLogo,
    websiteUrl: 'https://www.bostonscientific.com/en-US/medical-specialties/pulmonology.html',
  },
  {
    id: 'circulogene',
    name: 'Circulogene',
    logoSrc: circulogeneLogo,
    websiteUrl: 'https://circulogene.com/',
  },
  {
    id: 'cook-medical',
    name: 'Cook Medical',
    logoSrc: cookMedicalLogo,
    websiteUrl: 'https://www.cookmedical.com/',
  },
  {
    id: 'erbe',
    name: 'ERBE',
    logoSrc: erbeLogo,
    websiteUrl: 'https://us.erbegroup.com/us-en/',
  },
  {
    id: 'fujifilm',
    name: 'Fujifilm',
    logoSrc: fujifilmLogo,
    websiteUrl: 'https://healthcaresolutions-us.fujifilm.com/products/endoscopy/pulmonology',
  },
  {
    id: 'intuitive',
    name: 'Intuitive',
    logoSrc: intuitiveLogo,
    websiteUrl: 'https://www.intuitive.com/en-us/products-and-services/ion',
  },
  {
    id: 'monarch',
    name: 'Monarch',
    logoSrc: monarchLogo,
    websiteUrl: 'https://www.jnjmedtech.com/en-US/products/robotics/monarch-platform/bronchoscopy/',
  },
  {
    id: 'noah',
    name: 'Noah Medical',
    logoSrc: noahLogo,
    websiteUrl: 'https://www.noahmed.com/',
  },
  {
    id: 'olympus',
    name: 'Olympus',
    logoSrc: olympusLogo,
    websiteUrl: 'https://medical.olympusamerica.com/specialty/pulmonology',
  },
  {
    id: 'thoracent',
    name: 'Thoracent',
    logoSrc: thoracentLogo,
    websiteUrl: 'https://thoracent.com/about-us/',
  },
];
