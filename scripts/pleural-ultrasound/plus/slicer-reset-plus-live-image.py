"""Remove stale Image_Reference and reconnect Slicer to the live PLUS stream.

This also configures the Green slice view to follow the incoming tracked 2D
ultrasound image plane. Without Volume Reslice Driver, Slicer may show a mostly
black pane with brief flashes because the Green slice cuts through the moving
ultrasound plane instead of staying coplanar with it.

Run from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-reset-plus-live-image.py").read())
"""

import time

import slicer  # type: ignore


HOST = "localhost"
PORT = 18944
IMAGE_NODE_NAME = "Image_Reference"
CT_NODE_NAME = "19_CT_HR"
GREEN_SLICE_NODE_ID = "vtkMRMLSliceNodeGreen"
IMAGE_PLANE_MODE = 6


def find_node(name):
    try:
        return slicer.util.getNode(name)
    except slicer.util.MRMLNodeNotFoundException:
        return None


def remove_stale_image():
    node = find_node(IMAGE_NODE_NAME)
    if node is None:
        print(f"No existing {IMAGE_NODE_NAME} node found.")
        return
    slicer.mrmlScene.RemoveNode(node)
    print(f"Removed stale {IMAGE_NODE_NAME} node.")


def get_connector():
    connectors = slicer.util.getNodesByClass("vtkMRMLIGTLConnectorNode")
    for connector in connectors:
        if connector.GetName() in ("PleuralPLUSConnector", "IGTLConnector"):
            return connector

    connector = slicer.mrmlScene.AddNewNodeByClass(
        "vtkMRMLIGTLConnectorNode",
        "PleuralPLUSConnector",
    )
    return connector


def restart_connector(connector):
    try:
        connector.Stop()
    except Exception:
        pass
    slicer.app.processEvents()
    time.sleep(0.2)
    slicer.app.processEvents()
    connector.SetTypeClient(HOST, PORT)
    connector.Start()
    print(f"Connector {connector.GetName()} restarted as client {HOST}:{PORT}.")


def wait_for_image(timeout_sec=10.0):
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        slicer.app.processEvents()
        node = find_node(IMAGE_NODE_NAME)
        if node is not None and node.GetImageData() is not None:
            dims = node.GetImageData().GetDimensions()
            if dims[0] > 1 and dims[1] > 1:
                return node
        time.sleep(0.1)
    return None


def set_background(slice_view_name, volume_node):
    layout_manager = slicer.app.layoutManager()
    if layout_manager is None:
        return
    slice_widget = layout_manager.sliceWidget(slice_view_name)
    if slice_widget is None:
        return
    composite = slice_widget.sliceLogic().GetSliceCompositeNode()
    composite.SetLinkedControl(False)
    composite.SetBackgroundVolumeID(volume_node.GetID() if volume_node else None)
    composite.SetForegroundVolumeID(None)
    composite.SetForegroundOpacity(0.0)


def configure_green_ultrasound_view(image_node):
    green_slice_node = slicer.mrmlScene.GetNodeByID(GREEN_SLICE_NODE_ID)
    if green_slice_node is None:
        raise RuntimeError("Could not find Green slice node.")

    set_background("Green", image_node)

    ct_node = find_node(CT_NODE_NAME)
    if ct_node is not None:
        set_background("Red", ct_node)
        set_background("Yellow", ct_node)

    green_slice_node.SetSliceResolutionMode(
        slicer.vtkMRMLSliceNode.SliceResolutionMatchVolumes
    )

    if not hasattr(slicer.modules, "volumereslicedriver"):
        print("VolumeResliceDriver module is not available.")
        print("Open IGT > Volume Reslice Driver and set Green driver manually.")
        return

    reslice_logic = slicer.modules.volumereslicedriver.logic()
    reslice_logic.SetDriverForSlice(image_node.GetID(), green_slice_node)
    reslice_logic.SetModeForSlice(IMAGE_PLANE_MODE, green_slice_node)
    reslice_logic.SetFlipForSlice(True, green_slice_node)

    layout_manager = slicer.app.layoutManager()
    if layout_manager is not None and layout_manager.sliceWidget("Green") is not None:
        layout_manager.sliceWidget("Green").sliceController().fitSliceToBackground()

    print(f"Green slice is now driven by live {IMAGE_NODE_NAME}.")
    print("If the probe sender is sweeping, the Green pane should update continuously.")


def main():
    remove_stale_image()
    connector = get_connector()
    restart_connector(connector)
    print(f"Waiting for a live {IMAGE_NODE_NAME} node...")
    image_node = wait_for_image()
    if image_node is None:
        print(f"No live {IMAGE_NODE_NAME} node appeared within 10 seconds.")
        print("Confirm PlusServer is listening on localhost:18944 and try again.")
        return
    configure_green_ultrasound_view(image_node)


main()
