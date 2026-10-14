from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0014_alter_wheatdiseaseimage_disease"),
    ]

    operations = [
        migrations.RenameField(
            model_name="wheatdiseaseimage",
            old_name="angle",
            new_name="background",
        ),
    ]
