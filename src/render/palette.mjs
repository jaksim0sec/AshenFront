export const palette=Object.freeze({background:'#1D2022',field:'#686D70',trench:'#292D30',soil:'#292D30',ridge:'#909498',debris:'#4B5054',shadow:'#1D2022',edge:'#D1D4D5',text:'#D1D4D5',teamA:'#879EAD',teamB:'#A27D7D',selection:'#D1D4D5'});
export function applyPalette(root){for(const [key,value] of Object.entries(palette))root.style.setProperty('--'+key,value);}
