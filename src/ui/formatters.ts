export const escapeHtml=(value: string): string=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]!));
export const formatTime=(seconds: number): string=>{const safe=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;return `${Math.floor(safe/60).toString().padStart(2,'0')}:${(safe%60).toString().padStart(2,'0')}`;};
