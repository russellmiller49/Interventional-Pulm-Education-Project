"""Set a practical Slicer layout for PLUS pleural ultrasound QA.

Run from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-set-plus-view-layout.py").read())
"""


def find_node(name):
    try:
        return slicer.util.getNode(name)  # noqa: F821 - provided by Slicer
    except slicer.util.MRMLNodeNotFoundException:  # noqa: F821 - provided by Slicer
        return None


def set_background(slice_name, node):
    widget = slicer.app.layoutManager().sliceWidget(slice_name)  # noqa: F821
    if widget is None or node is None:
        return
    composite = widget.mrmlSliceCompositeNode()
    composite.SetLinkedControl(False)
    composite.SetBackgroundVolumeID(node.GetID())
    composite.SetForegroundVolumeID(None)
    composite.SetLabelVolumeID(None)


def main():
    ct = find_node("19_CT_HR")
    ultrasound = find_node("Image_Reference")

    set_background("Red", ct)
    set_background("Yellow", ct)
    set_background("Green", ultrasound or ct)

    print("Slice views unlinked.")
    print("Red: CT anatomy")
    print("Green: Image_Reference ultrasound stream")
    print("Yellow: CT anatomy")


main()
