from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0017_rename_moderator_role_to_expert"),
    ]

    operations = [
        migrations.AddField(
            model_name="wheatdisease",
            name="condition",
            field=models.TextField(blank=True),
        ),
    ]
