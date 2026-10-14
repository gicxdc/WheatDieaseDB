from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0018_wheatdisease_condition"),
    ]

    operations = [
        migrations.AlterField(
            model_name="wheatdisease",
            name="prevention",
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name="wheatdisease",
            name="symptoms",
            field=models.TextField(blank=True),
        ),
    ]
