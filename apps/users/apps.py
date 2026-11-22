from importlib import import_module

from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "apps.users"
    label = "users"

    def ready(self):
        import_module("apps.users.schema")
