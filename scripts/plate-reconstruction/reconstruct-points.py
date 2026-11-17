#!/usr/bin/env python3
"""Reconstructs each locality in scratch/plate-reconstruction/points.json to where it lay at
the species' age, with the plate model named in model.json, and writes
scratch/plate-reconstruction/paleocoordinates.json for the build to merge.

A locality with coordinates is reconstructed from them. One with only a region
or country is reconstructed from that unit's center, taken from Natural Earth's
outlines: the centroid when it falls inside the unit, otherwise a point
guaranteed to lie inside it. Each point is assigned the plate of the model's
static polygon that contains it, and is left out, with the reason, when no
polygon contains it or the polygon's plate does not exist at the age.

The model and Natural Earth files are downloaded once into the cache directory
and checked against the checksums in model.json.

Usage: reconstruct.py [points.json] [paleocoordinates.json] [cache dir]
"""

import hashlib
import json
import os
import sys
import urllib.request
import zipfile

import pygplates
from shapely.geometry import shape
from shapely.ops import unary_union

script_dir = os.path.dirname(os.path.abspath(__file__))
data_root = os.path.normpath(os.path.join(script_dir, "..", ".."))
reconstruction_dir = os.path.join(data_root, "scratch", "plate-reconstruction")


def fetch(source, cache_dir):
    """Downloads a pinned file into the cache unless a copy with the right
    checksum is already there.

    Args:
        source: A dict with the file's `url` and `sha256`.
        cache_dir: Directory the file is kept in.

    Returns:
        The path of the verified file.
    """
    destination = os.path.join(cache_dir, os.path.basename(source["url"]))

    if not os.path.exists(destination) or compute_sha256(destination) != source["sha256"]:
        download = urllib.request.Request(source["url"], headers={"User-Agent": "open-paleo-data/1.0 (https://github.com/open-paleo/data)"})

        with urllib.request.urlopen(download, timeout=300) as response, open(destination, "wb") as output:
            output.write(response.read())

        if compute_sha256(destination) != source["sha256"]:
            raise SystemExit(f"{source['url']}: checksum does not match model.json")

    return destination


def compute_sha256(file_path):
    """Hashes a file.

    Args:
        file_path: The file to hash.

    Returns:
        The hex SHA-256 digest.
    """
    digest = hashlib.sha256()

    with open(file_path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)

    return digest.hexdigest()


def find_unit_center(geometries):
    """The center of an administrative unit: its centroid when that lies
    inside the unit, otherwise a point Shapely guarantees is inside.

    Args:
        geometries: The Shapely geometries making up the unit.

    Returns:
        (latitude, longitude) rounded to 0.0001 degrees.
    """
    union = unary_union(geometries)
    point = union.centroid

    if not union.contains(point):
        point = union.representative_point()

    return round(point.y, 4), round(point.x, 4)


def load_units(admin1_path, admin0_path):
    """Indexes Natural Earth's first-level units by ISO 3166-2 code and its
    countries by ISO 3166-1 code.

    Args:
        admin1_path: The admin-1 GeoJSON file.
        admin0_path: The admin-0 GeoJSON file.

    Returns:
        (regions, countries), each mapping a code to a list of geometries.
    """
    regions = {}
    countries = {}

    with open(admin1_path, encoding="utf-8") as handle:
        for feature in json.load(handle)["features"]:
            code = feature["properties"].get("iso_3166_2")

            if code and feature.get("geometry"):
                regions.setdefault(code, []).append(shape(feature["geometry"]))

    with open(admin0_path, encoding="utf-8") as handle:
        for feature in json.load(handle)["features"]:
            properties = feature["properties"]

            for key in ("ISO_A2", "ISO_A2_EH"):
                code = properties.get(key)

                if code and code != "-99" and feature.get("geometry"):
                    countries.setdefault(code, []).append(shape(feature["geometry"]))
                    break

    return regions, countries


def resolve_present_point(point, regions, countries, crosswalk):
    """The present-day position to reconstruct for a point.

    Args:
        point: One entry of points.json.
        regions: Natural Earth units by ISO 3166-2 code.
        countries: Natural Earth countries by ISO 3166-1 code.
        crosswalk: region-crosswalk.json.

    Returns:
        (latitude, longitude, approximate, reason); reason is set, and the
        point is None, when no center can be found.
    """
    if "latitude" in point:
        return point["latitude"], point["longitude"], False, None

    country = point.get("country")
    region = point.get("region")

    if region:
        country = region.split("-")[0]
        codes = [region] if region in regions else (crosswalk.get(region) or {}).get("natural_earth")

        if codes:
            geometries = [geometry for code in codes for geometry in regions.get(code, [])]

            if geometries:
                latitude, longitude = find_unit_center(geometries)
                return latitude, longitude, True, None

    if country in countries:
        latitude, longitude = find_unit_center(countries[country])
        return latitude, longitude, True, None

    return None, None, True, f"no outline for {region or country}"


def main():
    """Reconstructs every point and writes the results."""
    points_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(reconstruction_dir, "points.json")
    output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(reconstruction_dir, "paleocoordinates.json")
    cache_dir = sys.argv[3] if len(sys.argv) > 3 else os.path.join(reconstruction_dir, "cache")

    os.makedirs(cache_dir, exist_ok=True)

    with open(os.path.join(script_dir, "model.json"), encoding="utf-8") as handle:
        model = json.load(handle)

    with open(os.path.join(script_dir, "region-crosswalk.json"), encoding="utf-8") as handle:
        crosswalk = json.load(handle)

    with open(points_path, encoding="utf-8") as handle:
        points = json.load(handle)

    model_dir = os.path.join(cache_dir, model["model"])

    with zipfile.ZipFile(fetch(model, cache_dir)) as archive:
        archive.extractall(model_dir)

    regions, countries = load_units(
        fetch(model["regions"]["admin1"], cache_dir),
        fetch(model["regions"]["admin0"], cache_dir))

    rotation_model = pygplates.RotationModel(os.path.join(model_dir, model["rotations"]))
    partitioner = pygplates.PlatePartitioner(
        pygplates.FeatureCollection(os.path.join(model_dir, model["static_polygons"])),
        rotation_model)

    results = {}
    skipped = {}

    for point in points:
        latitude, longitude, approximate, reason = resolve_present_point(point, regions, countries, crosswalk)

        if reason:
            skipped[point["id"]] = reason
            continue

        position = pygplates.PointOnSphere(latitude, longitude)
        polygon = partitioner.partition_point(position)

        if polygon is None:
            skipped[point["id"]] = "outside every static polygon"
            continue

        feature = polygon.get_feature()

        if not feature.is_valid_at_time(point["age_ma"]):
            skipped[point["id"]] = f"plate {feature.get_reconstruction_plate_id()} not placed at {point['age_ma']} Ma"
            continue

        plate_id = feature.get_reconstruction_plate_id()
        rotated = rotation_model.get_rotation(point["age_ma"], plate_id) * position
        paleo_latitude, paleo_longitude = rotated.to_lat_lon()

        results[point["id"]] = {
            "latitude": round(paleo_latitude, 4),
            "longitude": round(paleo_longitude, 4),
            "latitude_present": latitude,
            "longitude_present": longitude,
            "age_ma": point["age_ma"],
            "model": model["model"],
            "model_plate_id": plate_id,
            "approximate": approximate,
            "region": point.get("region"),
            "country": point.get("country"),
        }

    with open(output_path, "w", encoding="utf-8") as handle:
        json.dump({"model": model["model"], "results": results, "skipped": skipped}, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Reconstructed {len(results)} of {len(points)} localities with {model['model']}; {len(skipped)} skipped.")

    for identifier, why in sorted(skipped.items()):
        print(f"  skipped {identifier}: {why}")


if __name__ == "__main__":
    main()
