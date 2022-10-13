from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in check_in/__init__.py
from check_in import __version__ as version

setup(
	name="check_in",
	version=version,
	description="Check in/out Employee",
	author="Alimerdan",
	author_email="al@gm.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
