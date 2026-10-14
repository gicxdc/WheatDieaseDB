from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0008_auditlog"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_url",
            field=models.URLField(blank=True),
        ),
    ]
