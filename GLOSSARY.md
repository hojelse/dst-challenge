# TheGreenDiamond

Scholarly publications matching "climate change" from Danish research institutions, published in 2025, harvested from OpenAlex and made searchable. Named as a nod to the Black Diamond, the Royal Danish Library in Copenhagen.

## Language

### Publications

**Publication**:
A single scholarly output (article, preprint, chapter, dataset, etc.) harvested from OpenAlex. Corresponds one-to-one with an OpenAlex "work".
_Avoid_: Work, paper, article, record

**Topic**:
A subject area OpenAlex assigns to a Publication from its current topic taxonomy, nested in a subfield, field and domain. A Publication has a few Topics, one of them primary.
_Avoid_: Concept (OpenAlex's deprecated taxonomy), keyword, subject, tag

### People and places

**Author**:
A person who wrote Publications, as the disambiguated OpenAlex author entity identified by its OpenAlex ID. The display name comes from that entity, not from how the name was printed on any one Publication.
_Avoid_: Researcher, contributor, raw author name

**Authorship**:
The link between one Publication and one Author: their position in the author list, whether they are a corresponding author, and their Affiliations on that Publication.
_Avoid_: Author entry, byline

**Affiliation**:
An Institution that an Author listed on one specific Publication. Belongs to an Authorship; the same Author may have different Affiliations on different Publications.
_Avoid_: Membership, employer

**Institution**:
A research organisation as an OpenAlex institution entity (university, hospital, company, agency), with exactly one Country.
_Avoid_: Organisation, university, affiliation (that is the link, not the place)

**Country**:
The country an Institution is located in, as an ISO 3166-1 alpha-2 code. A Country belongs to an Institution only; Authors and Publications reach a Country through Affiliations.
_Avoid_: Nationality, origin

**Danish Author**:
An Author with at least one Affiliation at an Institution whose Country is Denmark, anywhere in the harvested Publications. A derived notion, not a stored flag.
_Avoid_: Danish researcher, local author
