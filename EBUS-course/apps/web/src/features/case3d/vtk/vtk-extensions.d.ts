declare module '@kitware/vtk.js/Rendering/Profiles/All' {
  const value: unknown;
  export default value;
}

declare module '@kitware/vtk.js/Filters/General/ImageMarchingCubes' {
  const vtkImageMarchingCubes: {
    newInstance(initialValues?: Record<string, unknown>): any;
  };
  export default vtkImageMarchingCubes;
}

declare module '@kitware/vtk.js/Widgets/Widgets3D/ImplicitPlaneWidget' {
  const vtkImplicitPlaneWidget: {
    newInstance(initialValues?: Record<string, unknown>): any;
  };
  export default vtkImplicitPlaneWidget;
}
