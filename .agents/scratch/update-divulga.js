const fs = require('fs');

const path = 'c:\\dgre\\src\\app\\agenda-anexo-v\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove old !isMM buttons from right panel
const searchRightPanel = `                                            {!isMM && (
                                                <div className="flex-1 relative">
                                                    <GuideStep step={1} message="Asigna personal para la actividad" active={minStep === 1} onClick={() => setAssigningSolicitud(item)} position="left" />
                                                    <Button variant="outline" size="sm" className="w-full h-11 rounded-xl font-black uppercase text-[11px] border-2" onClick={() => setAssigningSolicitud(item)} title="Gestionar Personal Asignado">
                                                        <UserPlus className="h-4 w-4 mr-2" /> ASIGNAR
                                                    </Button>
                                                </div>
                                            )}`;
content = content.replace(searchRightPanel, '');

// 2. Add activeDivStep
const searchActiveStep = `                          if (!(item.cant_hombres || item.cant_mujeres)) return 7;
                          if (!hasRetorno) return 8;
                          return 9; // Concluido
                      })();

                     const showStep1 = !hasPersonnel;`;

const replaceActiveStep = `                          if (!(item.cant_hombres || item.cant_mujeres)) return 7;
                          if (!hasRetorno) return 8;
                          return 9; // Concluido
                      })();

                     const activeDivStep = (() => {
                          if (assignedList.length === 0) return 1;
                          if (!item.qr_enabled) return 2;
                          if (!isQRViewed) return 3;
                          if (!hasSalida) return 4;
                          if (pendingAnexoIII) return 5;
                          if (!hasRetorno) return 6;
                          return 7; // Concluido
                     })();

                     const showStep1 = !hasPersonnel;`;
content = content.replace(searchActiveStep, replaceActiveStep);

// 3. Replace the big !isMM block with the new Grid
const gridCode = `
                                {!isMM && (
                                    <div className="mt-6 pt-6 border-t border-dashed border-indigo-200">
                                        <div className="flex justify-between items-center mb-4">
                                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest flex items-center gap-2">
                                                <ClipboardCheck className="h-4 w-4 text-indigo-600 animate-pulse" />
                                                PROCESO DE DIVULGACIÓN
                                            </p>
                                            {!item.fecha_cumplido && isFulfilled && (
                                                <Button className="h-8 px-6 rounded-lg font-black uppercase text-[10px] bg-green-600 hover:bg-green-700 text-white shadow-lg animate-pulse" onClick={() => setConcludingSolicitud(item)}>CONCLUIR ACTIVIDAD</Button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 animate-fade-in">
                                            {/* Paso 1: Asignar Personal */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                (item.divulgadores || item.asignados || []).length > 0 ? "bg-green-50/50 border-green-200 text-green-700" : "bg-indigo-50/30 border-indigo-100/80 text-indigo-600 animate-pulse"
                                            )}>
                                                {activeDivStep === 1 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 1</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Asignar Personal</span>
                                                </div>
                                                {(item.divulgadores || item.asignados || []).length > 0 ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                ) : (
                                                    <Button size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => setAssigningSolicitud(item)}>ASIGNAR</Button>
                                                )}
                                            </div>

                                            {/* Paso 2: Encender QR */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                item.qr_enabled ? "bg-green-50/50 border-green-200 text-green-700" : ((item.divulgadores || item.asignados || []).length > 0 ? "bg-indigo-50/30 border-indigo-100/80 text-indigo-600" : "bg-muted/10 border-transparent opacity-40")
                                            )}>
                                                {activeDivStep === 2 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 2</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Encender QR</span>
                                                </div>
                                                {item.qr_enabled ? (
                                                    <div className="flex flex-col items-center gap-1.5 w-full">
                                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                        <Button 
                                                            size="sm" 
                                                            className="h-5 px-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-[7px] font-black uppercase shrink-0 transition-transform active:scale-95 shadow-sm border border-red-200" 
                                                            onClick={() => handleToggleQr(item)}
                                                        >
                                                            APAGAR
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button disabled={(item.divulgadores || item.asignados || []).length === 0} size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => handleToggleQr(item)}>ENCENDER</Button>
                                                )}
                                            </div>

                                            {/* Paso 3: Imprimir QR */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                isQRViewed ? "bg-green-50/50 border-green-200 text-green-700" : (item.qr_enabled ? "bg-indigo-50/30 border-indigo-100/80 text-indigo-600 animate-pulse" : "bg-muted/10 border-transparent opacity-40")
                                            )}>
                                                {activeDivStep === 3 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 3</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Imprimir QR</span>
                                                </div>
                                                {isQRViewed ? (
                                                    <div className="flex flex-col items-center gap-1.5 w-full">
                                                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                        <Button size="sm" className="h-5 px-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-[7px] font-black uppercase shrink-0 shadow-sm" onClick={() => { const url = window.location.origin + \`/encuesta-satisfaccion?solicitudId=\${item.id}\`; setQrSolicitud({ ...item, qr_url: url }); markQRAsViewed(item.id); }}>
                                                            REIMPRIMIR
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button disabled={!qrActive} size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => { const url = window.location.origin + \`/encuesta-satisfaccion?solicitudId=\${item.id}\`; setQrSolicitud({ ...item, qr_url: url }); markQRAsViewed(item.id); }}>IMPRIMIR</Button>
                                                )}
                                            </div>

                                            {/* Paso 4: Form. Salida */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                hasSalida ? "bg-green-50/50 border-green-200 text-green-700" : (isQRViewed ? "bg-indigo-50/30 border-indigo-100/80 text-indigo-600 animate-pulse" : "bg-muted/10 border-transparent opacity-40")
                                            )}>
                                                {activeDivStep === 4 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 4</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Form. Salida</span>
                                                </div>
                                                {hasSalida ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                ) : (
                                                    <Button disabled={!isQRViewed} size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => router.push(\`/control-movimiento-maquinas?solicitudId=\${item.id}\`)}>SALIDA</Button>
                                                )}
                                            </div>

                                            {/* Paso 5: Informe (Dropdown for multiple missing) */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                !pendingAnexoIII && (item.divulgadores || item.asignados || []).length > 0 ? "bg-green-50/50 border-green-200 text-green-700" : (hasSalida ? "bg-indigo-50/30 border-indigo-100/80 text-indigo-600 animate-pulse" : "bg-muted/10 border-transparent opacity-40")
                                            )}>
                                                {activeDivStep === 5 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 5</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Informe</span>
                                                </div>
                                                {!pendingAnexoIII && (item.divulgadores || item.asignados || []).length > 0 ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                ) : (
                                                    missingInformesFrom.length > 1 ? (
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button disabled={!hasSalida} size="sm" className="h-7 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[7px] font-black uppercase shrink-0 shadow-sm border border-indigo-700">INFORME ({missingInformesFrom.length})</Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-56 p-2 rounded-xl shadow-xl border-none">
                                                                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2 px-2">Seleccione a quién reportar:</p>
                                                                <div className="flex flex-col gap-1">
                                                                    {missingInformesFrom.map((d) => (
                                                                        <Button key={d.id} variant="ghost" size="sm" className="justify-start text-[10px] font-bold uppercase h-8" onClick={() => router.push(\`/informe-divulgador?solicitudId=\${item.id}&reporterUid=\${d.id}\`)}>
                                                                            <User className="h-3 w-3 mr-2 text-indigo-600" /> {d.nombre}
                                                                        </Button>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    ) : (
                                                        <Button disabled={!hasSalida} size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => {
                                                            const targetId = missingInformesFrom.length === 1 ? \`&reporterUid=\${missingInformesFrom[0].id}\` : '';
                                                            router.push(\`/informe-divulgador?solicitudId=\${item.id}\${targetId}\`);
                                                        }}>INFORME</Button>
                                                    )
                                                )}
                                            </div>

                                            {/* Paso 6: Retorno MV */}
                                            <div className={cn(
                                                "p-3 rounded-2xl border-2 flex flex-col items-center justify-between gap-2 text-center transition-all duration-300 relative",
                                                hasRetorno ? "bg-green-50/50 border-green-200 text-green-700" : (!pendingAnexoIII && (item.divulgadores || item.asignados || []).length > 0 ? "bg-indigo-50/30 border-indigo-100/80 text-indigo-600 animate-pulse" : "bg-muted/10 border-transparent opacity-40")
                                            )}>
                                                {activeDivStep === 6 && (
                                                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded-full shadow-md animate-bounce tracking-wider border border-white z-10 whitespace-nowrap">
                                                        PENDIENTE
                                                    </span>
                                                )}
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] font-black opacity-60 uppercase">Paso 6</span>
                                                    <span className="text-[9px] font-black uppercase mt-1 leading-tight">Retorno MV</span>
                                                </div>
                                                {hasRetorno ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                                                ) : (
                                                    <Button disabled={pendingAnexoIII || (item.divulgadores || item.asignados || []).length === 0} size="sm" className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[8px] font-black uppercase shrink-0" onClick={() => router.push(\`/control-movimiento-maquinas?solicitudId=\${item.id}\`)}>RETORNO</Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
`;

let startIndex = content.indexOf('                                        {!isMM && (\\n                                            <>');
let endIndex = content.indexOf('                                {isMM && (');
if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + gridCode + '\\n' + content.substring(endIndex);
    fs.writeFileSync(path, content, 'utf8');
    console.log("SUCCESS");
} else {
    // Regex fallback
    let match = content.match(/\\s+\\{\\!isMM && \\(\[\\s\\S\]*?\\<\\/\>\\n\\s+\\)\\}\\n\\s+\\<\\/div\\>\\n\\s+\\<\\/div\\>\\n\\n\\s+\\{isMM/);
    if(match) {
        content = content.replace(match[0], gridCode + "\\n\\n                                {isMM");
        fs.writeFileSync(path, content, 'utf8');
        console.log("SUCCESS WITH REGEX");
    } else {
        console.log("NOT FOUND");
    }
}
