# Why Halite?

Halite is the mineral form of sodium chloride, $\mathrm{NaCl}$: a familiar
example from solid-state physics.

## A crystal you already know

The rock-salt structure consists of two interpenetrating face-centred cubic
sublattices. Each ion has six nearest neighbours of the opposite kind.

For a cubic lattice, planes indexed by $(h,k,l)$ have spacing

$$
d_{hkl} = \frac{a}{\sqrt{h^2+k^2+l^2}}.
$$

Bragg's law connects that spacing to a diffraction angle:

$$
2d\sin\theta = n\lambda.
$$

## Follow the source

Here is a little [Python calculation](spacing.py). Halite can preview linked
source without running it.

```python
from math import sqrt

def plane_spacing(a, h, k, l):
    return a / sqrt(h*h + k*k + l*l)
```

[Back to the welcome document](README.md)
