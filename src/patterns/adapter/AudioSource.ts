export interface AudioSource { readonly url: string; retain(): void; release(): void; }
export interface AudioSourceHandler { create(file: File): AudioSource; }
