from math import sqrt


def plane_spacing(a, h, k, l):
    """Interplanar spacing for a cubic lattice in the units used for a."""
    return a / sqrt(h * h + k * k + l * l)
