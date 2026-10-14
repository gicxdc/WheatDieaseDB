from django.db import migrations


LABEL_FIELDS = ("caption", "location", "background", "weather", "time_of_day")


def fill_empty_image_label_fields(apps, schema_editor):
    WheatDiseaseImage = apps.get_model("api", "WheatDiseaseImage")

    for field_name in LABEL_FIELDS:
        filter_kwargs = {field_name: ""}
        WheatDiseaseImage.objects.filter(**filter_kwargs).update(**{field_name: "None"})


def restore_empty_image_label_fields(apps, schema_editor):
    WheatDiseaseImage = apps.get_model("api", "WheatDiseaseImage")

    for field_name in LABEL_FIELDS:
        filter_kwargs = {field_name: "None"}
        WheatDiseaseImage.objects.filter(**filter_kwargs).update(**{field_name: ""})


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0015_rename_angle_wheatdiseaseimage_background"),
    ]

    operations = [
        migrations.RunPython(fill_empty_image_label_fields, restore_empty_image_label_fields),
    ]
