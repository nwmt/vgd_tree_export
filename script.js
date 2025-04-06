// --- DOM Elements ---
const vgdUrlInput = document.getElementById('vgdUrl');
const processUrlBtn = document.getElementById('processUrlBtn');
const dataSection = document.getElementById('dataSection');
const dataUrlLink = document.getElementById('dataUrlLink');
const treeDataTextArea = document.getElementById('treeData');
const enableRankingCheckbox = document.getElementById('enableRankingCheckbox');
const generateBtn = document.getElementById('generateBtn');
const outputSection = document.getElementById('outputSection');
const graphContainerWrapper = document.getElementById('graphContainerWrapper');
const graphContainer = document.getElementById('graphContainer');
const errorContainer = document.getElementById('errorContainer');
const downloadSvgBtn = document.getElementById('downloadSvgBtn');
const downloadPngBtn = document.getElementById('downloadPngBtn'); // PNG Button
const downloadJsonBtn = document.getElementById('downloadJsonBtn'); // JSON Button
const downloadDotBtn = document.getElementById('downloadDotBtn');
const loader = document.getElementById('loader');
const themeSwitch = document.getElementById('themeSwitch');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const pngCanvas = document.getElementById('pngCanvas'); // Canvas for PNG export

// --- State Variables ---
let currentDotString = '';
let currentSvgContent = '';
let currentParsedData = null; // Store parsed data for JSON export
let panZoomInstance = null; // Store svg-pan-zoom instance

// --- Helper Functions ---

function showError(message) {
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

function parseBirthYear(yearStr) {
    if (!yearStr) return null;
    const match = yearStr.match(/\b(\d{4})\b/);
    return match ? parseInt(match[1], 10) : null;
}

function applyTheme(isDark) {
     document.body.classList.toggle('dark-mode', isDark);
     if(themeSwitch) themeSwitch.selected = isDark;
     try {
       localStorage.setItem('theme', isDark ? 'dark' : 'light');
     } catch (e) { console.warn("Could not save theme preference to localStorage"); }
}

function setupPanZoom(svgElement) {
    // Ensure previous instance is destroyed
    if (panZoomInstance) {
        try {
            panZoomInstance.destroy();
        } catch (e) { console.warn("Error destroying previous panZoomInstance:", e); }
        panZoomInstance = null;
    }
    // Ensure library and element are ready
    if (svgElement && typeof svgPanZoom !== 'undefined') {
        try {
            panZoomInstance = svgPanZoom(svgElement, {
                zoomEnabled: true,
                controlIconsEnabled: false,
                fit: true,
                center: true,
                minZoom: 0.1, // Allow zooming out further
                maxZoom: 50,  // Allow zooming in further
                zoomScaleSensitivity: 0.3,
                panEnabled: true,
                preventMouseEventsDefault: true,

                beforePan: function() { },
                beforeZoom: function() { }
            });

            window.addEventListener('resize', () => {
                setTimeout(() => {
                    if (panZoomInstance) {
                        try {
                            panZoomInstance.resize();
                            panZoomInstance.updateBBox();
                            panZoomInstance.fit();
                            panZoomInstance.center();
                        } catch(e) { console.warn("Error resizing panZoom:", e); }
                    }
                }, 100);
            });

            // Initial fit/center
             panZoomInstance.fit();
             panZoomInstance.center();
             console.log("svg-pan-zoom initialized.");

        } catch (e) {
            console.error("Error initializing svg-pan-zoom:", e);
            showError(`Не удалось инициализировать масштабирование/панорамирование: ${e.message}`);
            // Optionally disable pan/zoom controls if init fails
            zoomInBtn.disabled = true;
            zoomOutBtn.disabled = true;
            resetZoomBtn.disabled = true;
        }

    } else if (!svgElement) {
         console.warn("No SVG element found to apply pan/zoom.");
    } else {
         console.warn("svg-pan-zoom library (svgPanZoom function) not loaded or available.");
         // Optionally disable pan/zoom controls
         zoomInBtn.disabled = true;
         zoomOutBtn.disabled = true;
         resetZoomBtn.disabled = true;
    }
}

// --- Event Listeners ---

processUrlBtn.addEventListener('click', () => {
    const url = vgdUrlInput.value.trim();
    if (!url) { alert('Пожалуйста, вставьте URL.'); return; }

    outputSection.classList.add('hidden');
    graphContainer.innerHTML = '<span class="placeholder-text md-typescale-body-medium">Граф появится здесь...</span>';
    errorContainer.classList.add('hidden'); errorContainer.textContent = '';
    downloadSvgBtn.disabled = true; downloadPngBtn.disabled = true;
    downloadJsonBtn.disabled = true; downloadDotBtn.disabled = true;
    generateBtn.disabled = true;
    currentDotString = ''; currentSvgContent = ''; currentParsedData = null;
    treeDataTextArea.value = '';
    if (panZoomInstance) { panZoomInstance.destroy(); panZoomInstance = null; } // Reset pan/zoom

    let nParam; let dataUrl;
    try {
        const urlObj = new URL(url);
        const params = new URLSearchParams(urlObj.search);
        nParam = params.get('n');
        if (!nParam || !/^\d+$/.test(nParam)) throw new Error('Не удалось найти параметр "n" в URL.');
        dataUrl = `https://forum.vgd.ru/index.php?m=feed&a=tree_load2&tr=${nParam}`;
        dataUrlLink.href = dataUrl; dataUrlLink.textContent = dataUrl;
        dataSection.classList.remove('hidden');
        generateBtn.disabled = false;
        dataSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
         alert(`Ошибка обработки URL: ${error.message}`);
         console.error("URL processing error:", error);
         dataSection.classList.add('hidden');
         generateBtn.disabled = true;
    }
});

generateBtn.addEventListener('click', () => {
    const treeDataRaw = treeDataTextArea.value;
    if (!treeDataRaw || treeDataRaw.trim() === '') {
         alert('Пожалуйста, вставьте данные дерева в текстовое поле.');
         treeDataTextArea.focus(); return;
    }

    loader.style.display = 'block';
    outputSection.classList.add('hidden');
    graphContainer.innerHTML = '';
    errorContainer.classList.add('hidden'); errorContainer.textContent = '';
    downloadSvgBtn.disabled = true; downloadPngBtn.disabled = true;
    downloadJsonBtn.disabled = true; downloadDotBtn.disabled = true;
    currentDotString = ''; currentSvgContent = ''; currentParsedData = null;
    if (panZoomInstance) { panZoomInstance.destroy(); panZoomInstance = null; } // Reset pan/zoom
    console.clear();
    console.log("Starting graph generation...");

    setTimeout(() => { // Keep the outer setTimeout
        if (typeof Viz === 'undefined') {
             showError('Ошибка: Библиотека Viz.js не загружена.');
             loader.style.display = 'none';
             console.error("Viz is not defined!"); return;
        }
        try {
            const isDarkMode = document.body.classList.contains('dark-mode');
            const enableRanking = enableRankingCheckbox.checked;
            console.log("Parsing data...");
            const { dotString, errors, parsedData } = generateDotString(treeDataRaw, enableRanking, isDarkMode);
            currentDotString = dotString;
            currentParsedData = parsedData;

            console.log("Parsed Person Info:", parsedData.personInfo);
            console.log("Parsed Parent Links:", parsedData.childrenToParents);
            console.log("All Person IDs:", parsedData.allPersonIds);
            console.log("Generated DOT String (first 1000 chars):\n", dotString.substring(0, 1000));

            if (errors.length > 0) {
                showError("Предупреждения при обработке данных:\n" + errors.join("\n"));
                console.warn("Processing warnings:", errors);
            }
            if (!dotString || dotString.length < 30) {
                 throw new Error("Не удалось сгенерировать описание графа (DOT строка пуста). Проверьте вставленные данные.");
            }

            console.log("Rendering with Viz.js...");
            Viz.instance()
                .then(viz => {
                    console.log("Viz instance obtained.");
                    return viz.renderSVGElement(dotString, { engine: 'dot' });
                })
                .then(element => {
                    console.log("Viz.js Rendered Element:", element);
                    if (!element || !element.hasChildNodes()) {
                        throw new Error("Viz.js вернул пустой SVG элемент. Возможно, DOT строка содержит ошибки.");
                    }
                    graphContainer.innerHTML = ''; // Clear placeholder
                    graphContainer.appendChild(element);
                    currentSvgContent = element.outerHTML; // Store SVG content

                    // Make output visible BEFORE initializing pan/zoom
                    outputSection.classList.remove('hidden');
                    outputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    setTimeout(() => {
                        try {
                            const svgElement = graphContainer.querySelector('svg');
                            setupPanZoom(svgElement); // Initialize pan/zoom

                            // Enable buttons AFTER setup
                            downloadSvgBtn.disabled = false;
                            downloadPngBtn.disabled = false;
                            downloadJsonBtn.disabled = false;
                            downloadDotBtn.disabled = false;
                            console.log("Graph displayed and pan/zoom initialized (if possible).");
                        } catch(panZoomError) {
                            console.error("Error during delayed setupPanZoom:", panZoomError);
                             showError(`Граф отображен, но ошибка инициализации масштабирования: ${panZoomError.message}`);
                             // Enable download buttons even if pan/zoom fails
                             downloadSvgBtn.disabled = false;
                             downloadPngBtn.disabled = false;
                             downloadJsonBtn.disabled = false;
                             downloadDotBtn.disabled = false;
                        }
                    }, 50);

                })
                .catch(error => { // Catch errors from Viz.js instance() or renderSVGElement()
                    console.error("Viz.js or Rendering error:", error);
                    showError(`Ошибка рендеринга Graphviz: ${error.message || error}. Проверьте консоль (F12).`);
                    outputSection.classList.remove('hidden'); // Show section to display error
                })
                .finally(() => { // Finally runs regardless of success/error in the promise chain
                    loader.style.display = 'none'; // Hide loader here
                    console.log("Generation process finished.");
                });
        } catch (e) { // Catch errors from synchronous code (parsing, DOT generation)
            console.error("Graph generation critical error:", e);
            showError(`Критическая ошибка: ${e.message}. Проверьте консоль (F12).`);
            outputSection.classList.remove('hidden');
            loader.style.display = 'none';
        }
    }, 50); // Keep outer setTimeout
});


downloadSvgBtn.addEventListener('click', () => {
    if (!currentSvgContent) return;
    const blob = new Blob([currentSvgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'family_tree.svg';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

downloadDotBtn.addEventListener('click', () => {
    if (!currentDotString) return;
    const blob = new Blob([currentDotString], { type: 'text/vnd.graphviz;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'family_tree.dot';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

downloadJsonBtn.addEventListener('click', () => {
    if (!currentParsedData) { alert("Нет данных для экспорта в JSON."); return; }
    try {
        const exportData = {
            persons: currentParsedData.personInfo,
            relations: Object.fromEntries(
                Array.from(currentParsedData.childrenToParents.entries()).map(([childId, parentSet]) => [childId, Array.from(parentSet)])
            )
        };
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'family_data.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error("JSON Export Error:", e); alert("Не удалось экспортировать данные в JSON."); }
});

downloadPngBtn.addEventListener('click', () => {
    if (!currentSvgContent) { alert("Нет SVG для экспорта в PNG."); return; }
    const svgElement = graphContainer.querySelector('svg');
    if (!svgElement) { alert("Не найден SVG элемент для экспорта."); return; }

    const img = new Image();
    const svgBlob = new Blob([currentSvgContent], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
        const svgWidth = img.naturalWidth || svgElement.width.baseVal.value || 1200;
        const svgHeight = img.naturalHeight || svgElement.height.baseVal.value || 800;
        console.log(`Attempting to render PNG at ${svgWidth}x${svgHeight}`);

        pngCanvas.width = svgWidth;
        pngCanvas.height = svgHeight;
        const ctx = pngCanvas.getContext('2d');

        // Determine background color based on theme
        const isDarkMode = document.body.classList.contains('dark-mode');
        ctx.fillStyle = isDarkMode ? getComputedStyle(document.body).getPropertyValue('--md-sys-color-surface-container-low').trim() || '#1d1b20' : '#ffffff'; // Use CSS var or fallback
        ctx.fillRect(0, 0, pngCanvas.width, pngCanvas.height);

        try {
            ctx.drawImage(img, 0, 0, pngCanvas.width, pngCanvas.height);
            URL.revokeObjectURL(url);

            const pngUrl = pngCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl; a.download = 'family_tree.png';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch(e) {
            console.error("PNG Export Error (drawing or toDataURL):", e);
            alert("Не удалось экспортировать в PNG. Ошибка при отрисовке на холсте.");
            URL.revokeObjectURL(url); // Clean up blob URL even on error
        }
    };
    img.onerror = (e) => {
        console.error("Error loading SVG into image for PNG export:", e);
        alert("Ошибка загрузки SVG для конвертации в PNG.");
        URL.revokeObjectURL(url);
    };
    img.src = url;
});

// Theme Toggle
if (themeSwitch) {
    themeSwitch.addEventListener('change', (e) => {
        applyTheme(e.target.selected);
        // Re-generate graph with new theme colors if data exists
        if (currentDotString) {
            console.log("Theme changed. Regenerating graph...");
            // Trigger regeneration only if data is already present
             if (treeDataTextArea.value.trim()) {
                generateBtn.click();
             }
        }
    });
} else {
    console.warn("Theme switch element not found.");
}


// Pan/Zoom/Fullscreen Controls
if (zoomInBtn) zoomInBtn.addEventListener('click', () => panZoomInstance?.zoomIn());
if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => panZoomInstance?.zoomOut());
if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => {
    if (panZoomInstance) { panZoomInstance.reset(); panZoomInstance.center(); } // Use reset() for combined effect
});
if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        if (graphContainerWrapper.requestFullscreen) {
            graphContainerWrapper.requestFullscreen().catch(err => {
                alert(`Ошибка входа в полноэкранный режим: ${err.message} (${err.name})`);
            });
        } else { alert("Полноэкранный режим не поддерживается вашим браузером."); }
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
    }
});
document.addEventListener('fullscreenchange', () => {
    if (panZoomInstance) { // Recenter/refit when fullscreen changes
         setTimeout(() => { // Delay slightly after fullscreen change
             panZoomInstance.resize();
             panZoomInstance.fit();
             panZoomInstance.center();
         }, 100);
    }
});


// --- Initial Setup ---
// Apply saved theme on load
const savedTheme = localStorage.getItem('theme');
applyTheme(savedTheme === 'dark');

// --- DOT Generation Logic (no changes needed here) ---
function generateDotString(rawData, enableRanking, isDarkMode) {
    const personInfo = {}; const childrenToParents = new Map();
    const allPersonIds = new Set(); const errors = [];
    const preprocessedData = rawData.replace(/([MFCLHOPUB]\|)/g, '\n$1').trim();
    const lines = preprocessedData.split('\n');
    // Step 1: Parse data
    lines.forEach((line, index) => {
        line = line.trim(); if (!line) return;
        const parts = line.split('|'); const tag = parts[0];
        try {
            if (tag === 'M' || tag === 'F') {
                if (parts.length < 5) { return; }
                const personId = parseInt(parts[1], 10); if (isNaN(personId)) throw new Error(`Invalid Person ID line ${index+1}`);
                allPersonIds.add(personId);
                const name = parts[4].trim(); const surname = parts.length > 5 ? parts[5].trim() : ""; const fullName = `${name} ${surname}`.trim();
                const bornStr = parts.length > 6 ? parts[6].trim() : ""; const diedStr = parts.length > 7 ? parts[7].trim() : "";
                const years = (bornStr || diedStr) ? `(${bornStr} – ${diedStr})` : "";
                const birthYearNum = parseBirthYear(bornStr);
                personInfo[personId] = { name: fullName, gender: tag, years: years, birthYear: birthYearNum };
            } else if (tag === 'L') {
                if (parts.length !== 4) { return; }
                const childId = parseInt(parts[2], 10); const parentId = parseInt(parts[3], 10);
                if (isNaN(childId) || isNaN(parentId)) throw new Error(`Invalid Child/Parent ID line ${index+1}`);
                allPersonIds.add(childId); allPersonIds.add(parentId);
                if (!childrenToParents.has(childId)) childrenToParents.set(childId, new Set());
                childrenToParents.get(childId).add(parentId);
            }
        } catch (e) { errors.push(`Строка ${index + 1}: Ошибка парсинга "${line}". ${e.message}`); }
    });
    // Step 2: Generate DOT string
    let dot = 'digraph FamilyTreeStyled {\n';
    // Use CSS variables directly in DOT string for colors
    const bgColor = isDarkMode ? 'transparent' : 'transparent';
    const nodeFont = 'Roboto';
    const edgeParentColor = isDarkMode ? '#938f99' : '#757575'; // --md-sys-color-outline / grey
    const edgeChildColor = isDarkMode ? '#e6e1e5' : '#303030'; // --md-sys-color-on-background / dark grey

    dot += `  bgcolor="${bgColor}";\n`;
    dot += '  rankdir="TB"; pagedir="BR"; splines="spline"; concentrate="false"; outputorder="edgesfirst";\n';
    dot += '  nodesep="0.25"; ranksep="0.50";\n';
    dot += '  mclimit="99"; ratio="compress"; searchsize="100";';
    dot += `  node [fontname="${nodeFont}" shape="box" style="rounded,filled" fixedsize="false" width=0.3 height=0.3];\n`;
    dot += `  edge [fontname="${nodeFont}" len=0.5 style=solid color="gray50" arrowsize=0.5];\n`;

    if (allPersonIds.size === 0) {
        errors.push("Не найдено ни одного ID персоны в данных.");
         return { dotString: '', errors: errors, parsedData: { personInfo: {}, childrenToParents: new Map(), allPersonIds: new Set() } };
    }
    // Add person nodes
    allPersonIds.forEach(personId => {
        const node_id_str = `"${personId}"`;
        if (personInfo[personId]) {
            const info = personInfo[personId];
            let label = info.name.replace(/"/g, '\\"'); if (info.years) label += `\\n${info.years.replace(/"/g, '\\"')}`;

            const mFill = isDarkMode ? '#004788' : '#d0e3ff'; // Dark Blue vs Light Blue
            const mBorder = isDarkMode ? '#a8c7fa' : '#74a3ff';
            const mFont = isDarkMode ? '#d8e2ff' : '#001d36';
            const fFill = isDarkMode ? '#712747' : '#ffd8e4'; // Dark Pink vs Light Pink
            const fBorder = isDarkMode ? '#ffb0cc' : '#ff82a4';
            const fFont = isDarkMode ? '#ffdde9' : '#3b081f';

            const fillColor = info.gender === 'M' ? mFill : fFill;
            const fontColor = info.gender === 'M' ? mFont : fFont;
            const borderColor = info.gender === 'M' ? mBorder : fBorder;

            dot += `  ${node_id_str} [label="${label}", color="${borderColor}", fillcolor="${fillColor}", fontcolor="${fontColor}", fontname="${nodeFont}"];\n`;
        } else {
             const unknownBorder = isDarkMode ? '#938f99' : '#757575';
             const unknownFont = isDarkMode ? '#cac4d0' : '#49454f';
             dot += `  ${node_id_str} [label="ID: ${personId}", shape="rect", style="dashed", color="${unknownBorder}", fontcolor="${unknownFont}", fontname="${nodeFont}"];\n`;
        }
    });
    // Add union nodes and edges
    const processedParentPairs = new Set(); const unionNodes = new Map();
    childrenToParents.forEach((parentSet, childId) => {
        const childIdStr = `"${childId}"`; const parents = Array.from(parentSet);
        if (parents.length === 2) {
            const [p1Id, p2Id] = parents.sort((a, b) => a - b); const parentPairKey = `${p1Id}_${p2Id}`;
            const p1IdStr = `"${p1Id}"`; const p2IdStr = `"${p2Id}"`; let unionNodeId;
            if (!unionNodes.has(parentPairKey)) {
                unionNodeId = `"union_${parentPairKey}"`; unionNodes.set(parentPairKey, unionNodeId);
                dot += `  ${unionNodeId} [width="0.1", height="0.1", label=""];\n`;
                dot += `  ${p1IdStr} -> ${unionNodeId} [arrowhead="none", color="${edgeParentColor}"];\n`;
                dot += `  ${p2IdStr} -> ${unionNodeId} [arrowhead="none", color="${edgeParentColor}"];\n`;
                const rankPairKey = `${p1Id}_${p2Id}`;
                if (!processedParentPairs.has(rankPairKey)) { dot += `  { rank=same; ${p1IdStr}; ${p2IdStr} };\n`; processedParentPairs.add(rankPairKey); }
            } else { unionNodeId = unionNodes.get(parentPairKey); }
            dot += `  ${unionNodeId} -> ${childIdStr} [color="${edgeChildColor}"];\n`;
        } else if (parents.length === 1) {
            const parentIdStr = `"${parents[0]}"`; dot += `  ${parentIdStr} -> ${childIdStr} [color="${edgeChildColor}"];\n`;
        } else { errors.push(`Ребенок ${childId} имеет ${parents.length} родителей: ${parents}. Связи не добавлены.`); }
    });
    // Optional ranking by decade
    if (enableRanking) {
        const nodesByDecade = new Map();
        Object.entries(personInfo).forEach(([personId, info]) => {
            if (info.birthYear !== null) {
                const decade = Math.floor(info.birthYear / 10) * 10;
                if (!nodesByDecade.has(decade)) nodesByDecade.set(decade, []);
                nodesByDecade.get(decade).push(`"${personId}"`);
            }
        });
        const sortedDecades = Array.from(nodesByDecade.keys()).sort((a, b) => a - b);
        sortedDecades.forEach(decade => {
            const nodesInRank = nodesByDecade.get(decade);
            if (nodesInRank.length > 0) dot += `  { rank=same; ${nodesInRank.join('; ')} };\n`;
        });
    }
    dot += '}';
    return { dotString: dot, errors: errors, parsedData: { personInfo, childrenToParents, allPersonIds } };
}

