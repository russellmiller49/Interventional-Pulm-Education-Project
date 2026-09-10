import { CANDIDATE_DISPLAY_LABELS } from "./candidateDisplayLabels";
import type { WebCase } from "./types";

export const SUPPORTED_LOCALES = ["en", "es", "zh-CN"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const en = {
  document: {
    htmlLang: "en",
    title: "Bronch Navigation Trainer"
  },
  loader: {
    failedCaseMetadata: (status: number) => `Failed to load case metadata: ${status}`,
    failedCtPreview: (status: number) => `Failed to load CT preview volume: ${status}`,
    failedScopeCalibration: (status: number) => `Failed to load scope calibration: ${status}`,
    unsupportedScopeCalibration: "Scope calibration JSON has an unsupported schema.",
    failedCandidateLabels: (status: number) => `Failed to load airway candidate labels: ${status}`,
    unsupportedCandidateLabels: "Airway candidate labels JSON has an unsupported schema.",
    failedAsset: (label: string, status: number) => `Failed to load ${label}: ${status}`,
    residualVolume: (assetId: string) => `${assetId} residual volume`,
    alphaVolume: (assetId: string) => `${assetId} alpha volume`
  },
  caseLabels: {
    noduleTargets: {
      beginner: "Beginner nodule",
      advanced: "Advanced nodule"
    },
    targetLocation: (index: number) => `Target ${index}`,
    noduleFallback: "Nodule"
  },
  app: {
    loadingCase: "Loading case",
    progressComplete: "complete",
    brand: "Bronch Navigation Trainer",
    status: {
      fullPathComplete: "Full path complete",
      fullPathPreview: "Full path preview",
      fullPathPaused: "Full path paused",
      decision: (index: number) => `Decision ${index}`,
      complete: "Complete",
      driving: "Driving",
      paused: "Paused"
    },
    targetPlacement: {
      target: (index: number) => `Target ${index}`,
      centralCheck: (index: number) => `Central check: Target ${index}`,
      snappedToTarget: (index: number) => `Snapped to Target ${index}`
    },
    calibration: {
      savingNode: (nodeKey: string, profile: string) => `Saving ${profile} Node ${nodeKey}...`,
      removingNode: (nodeKey: string, profile: string) => `Removing ${profile} Node ${nodeKey}...`,
      savedNode: (nodeKey: string, profile: string, path: string) => `Saved ${profile} Node ${nodeKey} in ${path}.`,
      removedNode: (nodeKey: string, profile: string, path: string) => `Removed ${profile} Node ${nodeKey} in ${path}.`,
      localOnly: (message: string) => `Local only: ${message}`,
      sourceSaveFailed: (status: number) => `source save failed with ${status}`
    },
    branchSelectAria: (label: string) => `Select branch ${label}`,
    actions: {
      driveOn: "Drive on",
      restartTest: "Restart test",
      restartRoute: "Restart route",
      moveScopeBackward: "Move scope backward",
      moveScopeForward: "Move scope forward",
      pause: "Pause",
      driveToBranch: "Drive to branch",
      back: "Back",
      next: "Next"
    },
    wizard: {
      trainerStepsAria: "Trainer steps",
      placeTarget: "Place target",
      practice: "Practice",
      test: "Test",
      placeTargetFirst: "Place a target first",
      stepOfThree: (step: number, label: string) => `Step ${step} of 3 - ${label}`
    },
    toggles: {
      centerline: "Centerline",
      candidates: "Candidates",
      airwayCt: "Airway CT",
      scopeDebug: "Scope debug",
      compass: "Compass",
      scopeTumor: "Scope tumor",
      scopeTrace: "Scope trace"
    },
    scopeProfiles: {
      ariaLabel: "Scope view profile",
      flexible: "Flexible",
      robotic: "Robotic"
    },
    hardware: {
      toggle: "Hardware scope",
      connected: "Scope connected",
      disconnected: "No scope",
      lowQualityShort: "Check tracking",
      lowQuality: "Low optical tracking quality - replace the wiper ring or wipe the scope cord"
    },
    caseStatus: {
      mode: "Mode",
      score: "Score",
      decision: "Decision",
      setup: "Setup"
    },
    instructions: {
      setup: [
        "Click Surprise me to place a target automatically.",
        "Drag the nodule preview onto a CT pane to snap the target near that spot.",
        "Use Centerline, CT slice controls, and the airway map to confirm the route, then switch to Practice."
      ],
      test: [
        "Use the CT views and virtual bronchoscope only.",
        "Drive to each branch, then choose A, B, or C from the scope view.",
        "Your final score counts first-choice correct answers."
      ],
      practice: [
        "Press Drive to move the scope to the next branch point.",
        "Compare the A/B/C labels in the bronchoscope view with the branch choices, select one, then press Drive on.",
        "Scroll CT slices or switch Airway CT on when you need more orientation; the route ends when the lesion is reached."
      ]
    },
    target: {
      section: "Target",
      noduleTarget: "Nodule target",
      testHelp: "Helper overlays are hidden. Navigate from CT images and the virtual bronchoscope.",
      status: (targetPlaced: boolean, targetOrdinal: number, targetCount: number, pathCount: number, pathsNarrowed: boolean) =>
        `${targetPlaced ? `Target ${targetOrdinal} of ${targetCount}. ` : "No nodule placed. "}${pathCount} accepted ${pathCount === 1 ? "path" : "paths"}${pathsNarrowed ? " from this branch" : ""}.`,
      surpriseMe: "Surprise me",
      placementHelp: "Drag the nodule preview onto any CT view to snap it to the nearest target location.",
      hideCentralCheck: "Hide central check",
      centralAirwayCheck: "Central airway check",
      flaggedTargets: (count: number) => `${count} flagged ${count === 1 ? "target" : "targets"}`,
      reviewQueue: "review queue",
      prevFlagged: "Prev flagged",
      nextFlagged: "Next flagged",
      beginnerTargetsNearCentralAirways: "Beginner targets near central airways",
      targetNumber: (index: number) => `Target ${index}`,
      acceptedPathsForTarget: "Accepted paths for this target",
      pathNumber: (index: number) => `Path ${index}`,
      prevTarget: "Prev target",
      nextTarget: "Next target",
      resetTarget: "Reset target",
      adjustTarget: "Adjust target",
      nodulePreviewAria: (label: string) => `${label} preview`
    },
    ctViews: {
      section: "CT views",
      airwayAligned: "Airway aligned",
      standardPlanes: "Standard planes",
      scrollSlices: "scroll slices",
      recenterSlices: "Recenter CT slices",
      zoomOutAria: "Zoom out CT slices",
      zoomInAria: "Zoom in CT slices",
      zoomLabel: (zoom: string) => `Zoom ${zoom}x`
    },
    debug: {
      section: "Scope debug",
      nodeLabel: (nodeId: number) => `Node ${nodeId}`,
      noActiveBranch: "No active branch",
      profileSource: (profile: string, path: string) => `${profile} in ${path}`,
      moveFullPathPreviewBackward: "Move full path preview backward",
      moveFullPathPreviewForward: "Move full path preview forward",
      driveFullPath: "Drive full path",
      replay: "Replay",
      resume: "Resume",
      previewPosition: (distanceMm: number) => `Preview position ${distanceMm} mm`,
      returnToBranchView: "Return to branch view",
      prevView: "Prev view",
      nextView: "Next view",
      help: "Drag A/B/C labels in the bronchoscope pane. Use these controls to advance/back up the camera and correct yaw, pitch, roll, and field of view for the current branch.",
      sliders: {
        back: "Back",
        aim: "Aim",
        yaw: "Yaw",
        pitch: "Pitch",
        roll: "Roll",
        fov: "FOV",
        degrees: "deg",
        millimeters: "mm"
      },
      resetScopeView: "Reset this scope view"
    },
    stats: {
      routeEdges: "Route edges",
      terminals: "Terminals"
    },
    complete: {
      lesionReached: "Lesion reached",
      routeComplete: "Route complete"
    },
    score: {
      section: "Test score",
      line: (scoreLabel: string, answeredCount: number) => `${scoreLabel} first choices correct across ${answeredCount} ${answeredCount === 1 ? "branch" : "branches"}.`,
      correct: "Correct",
      incorrect: "Incorrect"
    },
    feedback: {
      chooseBranch: "Pick A, B, or C from the bronchoscope view.",
      correctFirstAttempt: "Correct. First attempt recorded.",
      correctPathsRemain: (pathCount: number) => `Correct. ${pathCount} accepted ${pathCount === 1 ? "path remains" : "paths remain"} from here.`,
      wrongFirstAttempt: "Not this branch. First attempt recorded.",
      wrongShowCorrect: "Not this branch. The correct airway is shown in amber for comparison."
    }
  },
  bronchoscope: {
    title: "Virtual bronchoscope",
    decision: (index: number) => `Decision ${index}`,
    complete: "Complete",
    loadingAirwaySurface: "Loading airway surface",
    airwaySurfaceUnavailable: "Airway surface unavailable",
    selectBranchAria: (label: string) => `Select branch ${label}`,
    patientOrientationOverlay: "Patient orientation overlay"
  },
  ctPane: {
    standardTitles: {
      axial: "Axial",
      coronal: "Coronal",
      sagittal: "Sagittal"
    },
    airwayTitles: {
      axial: "Airway cross-section",
      coronal: "Airway long-axis A",
      sagittal: "Airway long-axis B"
    },
    targetMarker: "target",
    slicePositionAria: (title: string) => `${title} slice position`,
    airwayNormal: (suffix: string) => `normal ${suffix}`,
    airwayOffset: (suffix: string) => `offset ${suffix}`
  },
  airwayMap: {
    title: "3D airway path",
    navigationHint: "drag rotate / scroll zoom",
    showOptions: "Show options"
  }
};

export type Messages = typeof en;

const es: Messages = {
  document: {
    htmlLang: "es",
    title: "Entrenador de navegación bronquial"
  },
  loader: {
    failedCaseMetadata: (status) => `No se pudieron cargar los metadatos del caso: ${status}`,
    failedCtPreview: (status) => `No se pudo cargar el volumen de vista previa de TC: ${status}`,
    failedScopeCalibration: (status) => `No se pudo cargar la calibración del broncoscopio: ${status}`,
    unsupportedScopeCalibration: "El JSON de calibración del broncoscopio tiene un esquema no admitido.",
    failedCandidateLabels: (status) => `No se pudieron cargar las etiquetas candidatas de vía aérea: ${status}`,
    unsupportedCandidateLabels: "El JSON de etiquetas candidatas de vía aérea tiene un esquema no admitido.",
    failedAsset: (label, status) => `No se pudo cargar ${label}: ${status}`,
    residualVolume: (assetId) => `${assetId} volumen residual`,
    alphaVolume: (assetId) => `${assetId} volumen alfa`
  },
  caseLabels: {
    noduleTargets: {
      beginner: "Nódulo básico",
      advanced: "Nódulo avanzado"
    },
    targetLocation: (index) => `Objetivo ${index}`,
    noduleFallback: "Nódulo"
  },
  app: {
    loadingCase: "Cargando caso",
    progressComplete: "completo",
    brand: "Entrenador de navegación bronquial",
    status: {
      fullPathComplete: "Ruta completa finalizada",
      fullPathPreview: "Vista previa de la ruta completa",
      fullPathPaused: "Ruta completa en pausa",
      decision: (index) => `Decisión ${index}`,
      complete: "Completo",
      driving: "Avanzando",
      paused: "En pausa"
    },
    targetPlacement: {
      target: (index) => `Objetivo ${index}`,
      centralCheck: (index) => `Verificación central: objetivo ${index}`,
      snappedToTarget: (index) => `Ajustado al objetivo ${index}`
    },
    calibration: {
      savingNode: (nodeKey, profile) => `Guardando nodo ${nodeKey} de ${profile}...`,
      removingNode: (nodeKey, profile) => `Eliminando nodo ${nodeKey} de ${profile}...`,
      savedNode: (nodeKey, profile, path) => `Guardado nodo ${nodeKey} de ${profile} en ${path}.`,
      removedNode: (nodeKey, profile, path) => `Eliminado nodo ${nodeKey} de ${profile} en ${path}.`,
      localOnly: (message) => `Solo local: ${message}`,
      sourceSaveFailed: (status) => `falló el guardado de origen con estado ${status}`
    },
    branchSelectAria: (label) => `Seleccionar rama ${label}`,
    actions: {
      driveOn: "Continuar",
      restartTest: "Reiniciar prueba",
      restartRoute: "Reiniciar ruta",
      moveScopeBackward: "Mover el broncoscopio hacia atrás",
      moveScopeForward: "Mover el broncoscopio hacia adelante",
      pause: "Pausar",
      driveToBranch: "Avanzar hasta la rama",
      back: "Atrás",
      next: "Siguiente"
    },
    wizard: {
      trainerStepsAria: "Pasos del entrenador",
      placeTarget: "Colocar objetivo",
      practice: "Práctica",
      test: "Prueba",
      placeTargetFirst: "Coloque un objetivo primero",
      stepOfThree: (step, label) => `Paso ${step} de 3 - ${label}`
    },
    toggles: {
      centerline: "Línea central",
      candidates: "Candidatos",
      airwayCt: "TC de vía aérea",
      scopeDebug: "Depuración del broncoscopio",
      compass: "Brújula",
      scopeTumor: "Tumor en el broncoscopio",
      scopeTrace: "Trayectoria del broncoscopio"
    },
    scopeProfiles: {
      ariaLabel: "Perfil de vista del broncoscopio",
      flexible: "Flexible",
      robotic: "Robótica"
    },
    hardware: {
      toggle: "Broncoscopio físico",
      connected: "Broncoscopio conectado",
      disconnected: "Sin broncoscopio",
      lowQualityShort: "Revisar seguimiento",
      lowQuality: "Baja calidad de seguimiento óptico: reemplace el anillo limpiador o limpie el cordón"
    },
    caseStatus: {
      mode: "Modo",
      score: "Puntuación",
      decision: "Decisión",
      setup: "Configuración"
    },
    instructions: {
      setup: [
        "Haga clic en “Sorpréndeme” para colocar un objetivo automáticamente.",
        "Arrastre la vista previa del nódulo a un panel de TC para ajustar el objetivo cerca de ese punto.",
        "Use la línea central, los controles de cortes de TC y el mapa de la vía aérea para confirmar la ruta; luego cambie a Práctica."
      ],
      test: [
        "Use solo las vistas de TC y el broncoscopio virtual.",
        "Avance hasta cada rama y luego elija A, B o C en la vista del broncoscopio.",
        "La puntuación final cuenta las respuestas correctas de primer intento."
      ],
      practice: [
        "Pulse Avanzar para mover el broncoscopio al siguiente punto de ramificación.",
        "Compare las etiquetas A/B/C en la vista del broncoscopio con las opciones de rama, seleccione una y luego pulse Continuar.",
        "Desplace los cortes de TC o active la TC de vía aérea cuando necesite más orientación; la ruta termina al llegar a la lesión."
      ]
    },
    target: {
      section: "Objetivo",
      noduleTarget: "Objetivo de nódulo",
      testHelp: "Las superposiciones de ayuda están ocultas. Navegue con las imágenes de TC y el broncoscopio virtual.",
      status: (targetPlaced, targetOrdinal, targetCount, pathCount, pathsNarrowed) =>
        `${targetPlaced ? `Objetivo ${targetOrdinal} de ${targetCount}. ` : "No se ha colocado ningún nódulo. "}${pathCount} ${pathCount === 1 ? "ruta aceptada" : "rutas aceptadas"}${pathsNarrowed ? " desde esta rama" : ""}.`,
      surpriseMe: "Sorpréndeme",
      placementHelp: "Arrastre la vista previa del nódulo a cualquier vista de TC para ajustarlo a la ubicación objetivo más cercana.",
      hideCentralCheck: "Ocultar verificación central",
      centralAirwayCheck: "Verificación de vía aérea central",
      flaggedTargets: (count) => `${count} ${count === 1 ? "objetivo marcado" : "objetivos marcados"}`,
      reviewQueue: "cola de revisión",
      prevFlagged: "Marcado anterior",
      nextFlagged: "Marcado siguiente",
      beginnerTargetsNearCentralAirways: "Objetivos básicos cerca de vías aéreas centrales",
      targetNumber: (index) => `Objetivo ${index}`,
      acceptedPathsForTarget: "Rutas aceptadas para este objetivo",
      pathNumber: (index) => `Ruta ${index}`,
      prevTarget: "Objetivo anterior",
      nextTarget: "Objetivo siguiente",
      resetTarget: "Restablecer objetivo",
      adjustTarget: "Ajustar objetivo",
      nodulePreviewAria: (label) => `Vista previa de ${label}`
    },
    ctViews: {
      section: "Vistas de TC",
      airwayAligned: "Alineada con vía aérea",
      standardPlanes: "Planos estándar",
      scrollSlices: "desplazar cortes",
      recenterSlices: "Recentrar cortes de TC",
      zoomOutAria: "Alejar los cortes de TC",
      zoomInAria: "Acercar los cortes de TC",
      zoomLabel: (zoom) => `Zoom ${zoom}x`
    },
    debug: {
      section: "Depuración del broncoscopio",
      nodeLabel: (nodeId) => `Nodo ${nodeId}`,
      noActiveBranch: "No hay rama activa",
      profileSource: (profile, path) => `${profile} en ${path}`,
      moveFullPathPreviewBackward: "Mover la vista previa de ruta completa hacia atrás",
      moveFullPathPreviewForward: "Mover la vista previa de ruta completa hacia adelante",
      driveFullPath: "Recorrer ruta completa",
      replay: "Repetir",
      resume: "Reanudar",
      previewPosition: (distanceMm) => `Posición de vista previa ${distanceMm} mm`,
      returnToBranchView: "Volver a vista de rama",
      prevView: "Vista anterior",
      nextView: "Vista siguiente",
      help: "Arrastre las etiquetas A/B/C en el panel del broncoscopio. Use estos controles para avanzar o retroceder la cámara y corregir la guiñada, la inclinación, el balanceo y el campo de visión de la rama actual.",
      sliders: {
        back: "Retroceso",
        aim: "Apuntar",
        yaw: "Guiñada",
        pitch: "Inclinación",
        roll: "Balanceo",
        fov: "Campo de visión",
        degrees: "°",
        millimeters: "mm"
      },
      resetScopeView: "Restablecer esta vista del broncoscopio"
    },
    stats: {
      routeEdges: "Segmentos de ruta",
      terminals: "Terminales"
    },
    complete: {
      lesionReached: "Lesión alcanzada",
      routeComplete: "Ruta completa"
    },
    score: {
      section: "Puntuación de la prueba",
      line: (scoreLabel, answeredCount) => `${scoreLabel} respuestas correctas de primer intento en ${answeredCount} ${answeredCount === 1 ? "rama" : "ramas"}.`,
      correct: "Correctas",
      incorrect: "Incorrectas"
    },
    feedback: {
      chooseBranch: "Elija A, B o C en la vista del broncoscopio.",
      correctFirstAttempt: "Correcto. Primer intento registrado.",
      correctPathsRemain: (pathCount) => `Correcto. ${pathCount} ${pathCount === 1 ? "ruta aceptada restante" : "rutas aceptadas restantes"} desde aquí.`,
      wrongFirstAttempt: "No es esta rama. Primer intento registrado.",
      wrongShowCorrect: "No es esta rama. La vía aérea correcta se muestra en ámbar para compararla."
    }
  },
  bronchoscope: {
    title: "Broncoscopio virtual",
    decision: (index) => `Decisión ${index}`,
    complete: "Completo",
    loadingAirwaySurface: "Cargando superficie de la vía aérea",
    airwaySurfaceUnavailable: "Superficie de la vía aérea no disponible",
    selectBranchAria: (label) => `Seleccionar rama ${label}`,
    patientOrientationOverlay: "Superposición de orientación del paciente"
  },
  ctPane: {
    standardTitles: {
      axial: "Axial",
      coronal: "Coronal",
      sagittal: "Sagital"
    },
    airwayTitles: {
      axial: "Sección transversal de vía aérea",
      coronal: "Eje largo de vía aérea A",
      sagittal: "Eje largo de vía aérea B"
    },
    targetMarker: "objetivo",
    slicePositionAria: (title) => `Posición del corte: ${title}`,
    airwayNormal: (suffix) => `normal ${suffix}`,
    airwayOffset: (suffix) => `desplazamiento ${suffix}`
  },
  airwayMap: {
    title: "Ruta aérea 3D",
    navigationHint: "arrastrar para rotar / desplazar para zoom",
    showOptions: "Mostrar opciones"
  }
};

const zhCN: Messages = {
  document: {
    htmlLang: "zh-CN",
    title: "支气管导航训练器"
  },
  loader: {
    failedCaseMetadata: (status) => `病例元数据加载失败：${status}`,
    failedCtPreview: (status) => `CT 预览体数据加载失败：${status}`,
    failedScopeCalibration: (status) => `内镜校准加载失败：${status}`,
    unsupportedScopeCalibration: "内镜校准 JSON 的架构不受支持。",
    failedCandidateLabels: (status) => `气道候选标签加载失败：${status}`,
    unsupportedCandidateLabels: "气道候选标签 JSON 的架构不受支持。",
    failedAsset: (label, status) => `加载 ${label} 失败：${status}`,
    residualVolume: (assetId) => `${assetId} 残差体积`,
    alphaVolume: (assetId) => `${assetId} alpha 体数据`
  },
  caseLabels: {
    noduleTargets: {
      beginner: "初级结节",
      advanced: "高级结节"
    },
    targetLocation: (index) => `目标 ${index}`,
    noduleFallback: "结节"
  },
  app: {
    loadingCase: "正在加载病例",
    progressComplete: "完成",
    brand: "支气管导航训练器",
    status: {
      fullPathComplete: "完整路径已完成",
      fullPathPreview: "完整路径预览",
      fullPathPaused: "完整路径已暂停",
      decision: (index) => `决策点 ${index}`,
      complete: "完成",
      driving: "推进中",
      paused: "已暂停"
    },
    targetPlacement: {
      target: (index) => `目标 ${index}`,
      centralCheck: (index) => `中央气道检查：目标 ${index}`,
      snappedToTarget: (index) => `已吸附到目标 ${index}`
    },
    calibration: {
      savingNode: (nodeKey, profile) => `正在保存${profile}节点 ${nodeKey}...`,
      removingNode: (nodeKey, profile) => `正在移除${profile}节点 ${nodeKey}...`,
      savedNode: (nodeKey, profile, path) => `已保存${profile}节点 ${nodeKey}（${path}）。`,
      removedNode: (nodeKey, profile, path) => `已移除${profile}节点 ${nodeKey}（${path}）。`,
      localOnly: (message) => `仅本地：${message}`,
      sourceSaveFailed: (status) => `源文件保存失败，状态码 ${status}`
    },
    branchSelectAria: (label) => `选择分支 ${label}`,
    actions: {
      driveOn: "继续推进",
      restartTest: "重新开始测试",
      restartRoute: "重新开始路线",
      moveScopeBackward: "向后移动内镜",
      moveScopeForward: "向前移动内镜",
      pause: "暂停",
      driveToBranch: "推进到分支",
      back: "返回",
      next: "下一步"
    },
    wizard: {
      trainerStepsAria: "训练步骤",
      placeTarget: "放置目标",
      practice: "练习",
      test: "测试",
      placeTargetFirst: "请先放置目标",
      stepOfThree: (step, label) => `第 ${step} 步，共 3 步 - ${label}`
    },
    toggles: {
      centerline: "中心线",
      candidates: "候选项",
      airwayCt: "气道 CT",
      scopeDebug: "内镜调试",
      compass: "罗盘",
      scopeTumor: "内镜肿瘤",
      scopeTrace: "内镜轨迹"
    },
    scopeProfiles: {
      ariaLabel: "内镜视图配置",
      flexible: "柔性",
      robotic: "机器人"
    },
    hardware: {
      toggle: "实体内镜",
      connected: "内镜已连接",
      disconnected: "未检测到内镜",
      lowQualityShort: "检查追踪",
      lowQuality: "光学追踪质量低——请更换擦拭环或擦拭镜身"
    },
    caseStatus: {
      mode: "模式",
      score: "得分",
      decision: "决策点",
      setup: "设置"
    },
    instructions: {
      setup: [
        "点击“给我惊喜”自动放置目标。",
        "将结节预览拖到 CT 窗格上，把目标吸附到该位置附近。",
        "使用中心线、CT 切片控制和气道图确认路线，然后切换到练习。"
      ],
      test: [
        "仅使用 CT 视图和虚拟支气管镜。",
        "推进到每个分支，然后在内镜视图中选择 A、B 或 C。",
        "最终得分统计首次选择的正确答案。"
      ],
      practice: [
        "按“推进”将内镜移动到下一个分支点。",
        "比较支气管镜视图中的 A/B/C 标签与分支选项，选择一个，然后按“继续推进”。",
        "需要进一步定位时，滚动 CT 切片或开启气道 CT；到达病灶时路线结束。"
      ]
    },
    target: {
      section: "目标",
      noduleTarget: "结节目标",
      testHelp: "辅助叠加层已隐藏。请根据 CT 图像和虚拟支气管镜导航。",
      status: (targetPlaced, targetOrdinal, targetCount, pathCount, pathsNarrowed) =>
        `${targetPlaced ? `目标 ${targetOrdinal} / ${targetCount}。` : "尚未放置结节。"}已接受 ${pathCount} 条路径${pathsNarrowed ? "（来自此分支）" : ""}。`,
      surpriseMe: "给我惊喜",
      placementHelp: "将结节预览拖到任意 CT 视图上，以吸附到最近的目标位置。",
      hideCentralCheck: "隐藏中央气道检查",
      centralAirwayCheck: "中央气道检查",
      flaggedTargets: (count) => `${count} 个已标记目标`,
      reviewQueue: "复核队列",
      prevFlagged: "上一个已标记",
      nextFlagged: "下一个已标记",
      beginnerTargetsNearCentralAirways: "中央气道附近的初级目标",
      targetNumber: (index) => `目标 ${index}`,
      acceptedPathsForTarget: "此目标的已接受路径",
      pathNumber: (index) => `路径 ${index}`,
      prevTarget: "上一个目标",
      nextTarget: "下一个目标",
      resetTarget: "重置目标",
      adjustTarget: "调整目标",
      nodulePreviewAria: (label) => `${label}预览`
    },
    ctViews: {
      section: "CT 视图",
      airwayAligned: "气道对齐",
      standardPlanes: "标准平面",
      scrollSlices: "滚动切片",
      recenterSlices: "重新居中 CT 切片",
      zoomOutAria: "缩小 CT 切片",
      zoomInAria: "放大 CT 切片",
      zoomLabel: (zoom) => `缩放 ${zoom}x`
    },
    debug: {
      section: "内镜调试",
      nodeLabel: (nodeId) => `节点 ${nodeId}`,
      noActiveBranch: "无活动分支",
      profileSource: (profile, path) => `${profile}于 ${path}`,
      moveFullPathPreviewBackward: "向后移动完整路径预览",
      moveFullPathPreviewForward: "向前移动完整路径预览",
      driveFullPath: "推进完整路径",
      replay: "重播",
      resume: "继续",
      previewPosition: (distanceMm) => `预览位置 ${distanceMm} mm`,
      returnToBranchView: "返回分支视图",
      prevView: "上一个视图",
      nextView: "下一个视图",
      help: "在支气管镜窗格中拖动 A/B/C 标签。使用这些控件向前/向后移动相机，并校正当前分支的偏航、俯仰、滚转和视野。",
      sliders: {
        back: "后退",
        aim: "瞄准",
        yaw: "偏航",
        pitch: "俯仰",
        roll: "滚转",
        fov: "视野",
        degrees: "°",
        millimeters: "mm"
      },
      resetScopeView: "重置此内镜视图"
    },
    stats: {
      routeEdges: "路径段",
      terminals: "末端"
    },
    complete: {
      lesionReached: "已到达病灶",
      routeComplete: "路线完成"
    },
    score: {
      section: "测试得分",
      line: (scoreLabel, answeredCount) => `在 ${answeredCount} 个分支中，首次选择正确 ${scoreLabel}。`,
      correct: "正确",
      incorrect: "错误"
    },
    feedback: {
      chooseBranch: "请在支气管镜视图中选择 A、B 或 C。",
      correctFirstAttempt: "正确。首次尝试已记录。",
      correctPathsRemain: (pathCount) => `正确。此处还有 ${pathCount} 条可接受路径。`,
      wrongFirstAttempt: "不是这个分支。首次尝试已记录。",
      wrongShowCorrect: "不是这个分支。正确气道以琥珀色显示，供对照。"
    }
  },
  bronchoscope: {
    title: "虚拟支气管镜",
    decision: (index) => `决策点 ${index}`,
    complete: "完成",
    loadingAirwaySurface: "正在加载气道表面",
    airwaySurfaceUnavailable: "气道表面不可用",
    selectBranchAria: (label) => `选择分支 ${label}`,
    patientOrientationOverlay: "患者方位叠加层"
  },
  ctPane: {
    standardTitles: {
      axial: "轴位",
      coronal: "冠状位",
      sagittal: "矢状位"
    },
    airwayTitles: {
      axial: "气道横断面",
      coronal: "气道长轴 A",
      sagittal: "气道长轴 B"
    },
    targetMarker: "目标",
    slicePositionAria: (title) => `${title}切片位置`,
    airwayNormal: (suffix) => `法线 ${suffix}`,
    airwayOffset: (suffix) => `偏移 ${suffix}`
  },
  airwayMap: {
    title: "3D 气道路径",
    navigationHint: "拖动旋转 / 滚动缩放",
    showOptions: "显示选项"
  }
};

const MESSAGES: Record<Locale, Messages> = {
  en,
  es,
  "zh-CN": zhCN
};

export function normalizeLocale(value: string | null | undefined): Locale {
  if (value === "es") {
    return "es";
  }
  if (value === "zh-CN" || value === "zh-Hans") {
    return "zh-CN";
  }
  return "en";
}

export function localeFromSearch(search: string): Locale {
  return normalizeLocale(new URLSearchParams(search).get("locale"));
}

export function localeFromWindow(): Locale {
  return typeof window === "undefined" ? "en" : localeFromSearch(window.location.search);
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

export function applyDocumentLocale(locale: Locale, messages: Messages) {
  document.documentElement.lang = messages.document.htmlLang;
  document.title = messages.document.title;
  document.documentElement.dataset.locale = locale;
}

export function localizeCaseMetadata(metadata: WebCase, locale: Locale): WebCase {
  const messages = getMessages(locale);
  return {
    ...metadata,
    noduleTargets: metadata.noduleTargets?.map((target) => ({
      ...target,
      label: messages.caseLabels.noduleTargets[target.id as keyof typeof messages.caseLabels.noduleTargets] ?? target.label,
      locations: target.locations?.map((location, index) => ({
        ...location,
        label: location.label || messages.caseLabels.targetLocation(index + 1)
      }))
    }))
  };
}

export function candidateDisplayLabel(locale: Locale, candidateLabel: string): string | undefined {
  if (locale === "en") {
    return undefined;
  }
  return CANDIDATE_DISPLAY_LABELS[locale][candidateLabel as keyof (typeof CANDIDATE_DISPLAY_LABELS)[typeof locale]];
}
