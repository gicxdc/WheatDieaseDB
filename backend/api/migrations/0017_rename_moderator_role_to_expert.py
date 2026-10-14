from django.db import migrations, models


def forwards(apps, schema_editor):
    User = apps.get_model("api", "User")
    User.objects.filter(role="moderator").update(role="expert")


def backwards(apps, schema_editor):
    User = apps.get_model("api", "User")
    User.objects.filter(role="expert").update(role="moderator")


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0016_fill_empty_image_label_fields"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                choices=[("admin", "Admin"), ("expert", "Expert"), ("user", "User")],
                default="user",
                max_length=20,
            ),
        ),
    ]
