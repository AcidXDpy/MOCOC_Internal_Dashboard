import unittest

import numpy as np
import pandas as pd

from research.methods import (conditional_diffusion, difference_in_differences,
                              kaplan_meier, labor_anomalies, moran_permutation,
                              pca_context, rca_matrix, rolling_forecast,
                              seasonal_naive, spatial_weights, specialization_network,
                              state_space)
from research.acquire import NJ_COUNTIES, normalize_cbp_sector


class PCATests(unittest.TestCase):
    def test_known_factor_recovered_and_scale_invariant(self):
        rng = np.random.default_rng(13)
        latent = rng.normal(size=100)
        x = latent[:, None] * [1, 2, 3] + rng.normal(scale=0.05, size=(100, 3))
        result = pca_context(x, bootstrap=40)
        rescaled = pca_context(x * [100, 0.2, 10], bootstrap=40)
        self.assertGreater(np.corrcoef(result["scores"], latent)[0, 1], 0.99)
        self.assertGreater(result["explainedVarianceRatio"], 0.99)
        np.testing.assert_allclose(result["scaledScores"], rescaled["scaledScores"])
        self.assertAlmostEqual(np.mean(result["scaledScores"]), 50)
        self.assertAlmostEqual(np.std(result["scaledScores"]), 10)

    def test_constant_and_small_panel_rejected(self):
        with self.assertRaises(ValueError):
            pca_context(np.ones((50, 3)))
        with self.assertRaises(ValueError):
            pca_context(np.ones((10, 3)))


class SpatialTests(unittest.TestCase):
    def test_clustered_fixture_and_seed_reproducibility(self):
        coords = np.column_stack([40 + np.arange(24) / 100, np.full(24, -74)])
        weights = spatial_weights(coords, k=3)
        values = np.repeat([0, 10], 12) + np.arange(24) / 100
        result = moran_permutation(values, weights, permutations=199)
        repeated = moran_permutation(values, weights, permutations=199)
        self.assertGreater(result["statistic"], 0.6)
        self.assertLessEqual(result["pValue"], 0.02)
        np.testing.assert_array_equal(result["localP"], repeated["localP"])
        self.assertTrue(np.all(result["localQ"] >= result["localP"]))
        np.testing.assert_allclose(weights.sum(axis=1), 1)
        np.testing.assert_array_equal(np.diag(weights), 0)

    def test_scale_and_translation_invariant(self):
        coords = np.column_stack([40 + np.arange(12) / 100, np.full(12, -74)])
        weights = spatial_weights(coords, k=2)
        a = moran_permutation(np.arange(12), weights, permutations=99)
        b = moran_permutation(100 + 2 * np.arange(12), weights, permutations=99)
        self.assertAlmostEqual(a["statistic"], b["statistic"])
        with self.assertRaises(ValueError):
            moran_permutation(np.ones(12), weights, permutations=99)


class ForecastTests(unittest.TestCase):
    def fixture(self, n=160):
        rng = np.random.default_rng(18)
        return pd.Series(5 + np.sin(np.arange(n) * 2 * np.pi / 12) + rng.normal(0, 0.12, n),
                         index=pd.date_range("2000-01-01", periods=n, freq="MS"))

    def test_missing_month_is_not_imputed_observation(self):
        series = self.fixture()
        series.iloc[-4] = np.nan
        pred, lo, hi, diag = state_space(series, 3)
        self.assertTrue(diag["converged"])
        self.assertTrue(np.isfinite(pred).all())
        self.assertTrue(np.all(lo < hi))
        self.assertTrue(np.isnan(series.iloc[-4]))

    def test_seasonal_naive_last_observed_calendar_match(self):
        series = self.fixture()
        series.iloc[-12] = np.nan
        pred, lo, hi, _ = seasonal_naive(series, 2)
        self.assertEqual(pred[0], series.iloc[-24])
        self.assertEqual(pred[1], series.iloc[-11])
        self.assertTrue(np.all((lo <= pred) & (pred <= hi)))

    def test_anomaly_scores_do_not_use_future_values(self):
        series = self.fixture(180)
        altered = series.copy()
        altered.iloc[-1] += 20
        original = {r["date"]: r for r in labor_anomalies(series)}
        changed = {r["date"]: r for r in labor_anomalies(altered)}
        for d in sorted(original)[:-1]:
            self.assertEqual(original[d]["score"], changed[d]["score"])
            self.assertEqual(original[d]["pValue"], changed[d]["pValue"])
        self.assertGreater(abs(changed[sorted(changed)[-1]]["score"]), 10)

    def test_rolling_origin_actual_dates_and_missing_targets(self):
        series = self.fixture(145)
        series.iloc[-7] = np.nan
        _, _, _, _, validation, _ = rolling_forecast(series, folds=14)
        for record in validation["predictions"]:
            self.assertLess(record["origin"], record["date"])
            self.assertEqual(record["actual"], series.loc[record["date"]])
        self.assertNotIn(str(series.index[-7].date()), [r["date"] for r in validation["predictions"]])
        with self.assertRaises(ValueError):
            rolling_forecast(series.drop(series.index[10]), folds=14)


class NetworkTests(unittest.TestCase):
    def test_bulk_grouped_sectors_and_county_universe(self):
        self.assertEqual(normalize_cbp_sector("31----"), "31-33")
        self.assertEqual(normalize_cbp_sector("44----"), "44-45")
        self.assertEqual(normalize_cbp_sector("48----"), "48-49")
        self.assertEqual(normalize_cbp_sector("54----"), "54")
        self.assertEqual(normalize_cbp_sector("311///"), "311")
        self.assertEqual(len(NJ_COUNTIES), 21)
        self.assertNotIn("000", NJ_COUNTIES)
        self.assertNotIn("999", NJ_COUNTIES)

    def test_rca_known_shares(self):
        counts = np.array([[8, 2], [2, 8], [5, 5]])
        expected = np.array([[1.6, 0.4], [0.4, 1.6], [1, 1]])
        np.testing.assert_allclose(rca_matrix(counts), expected)
        graph, proximity = specialization_network(expected, threshold=0.4)
        self.assertAlmostEqual(proximity[0, 1], 0.5)
        self.assertEqual(graph.number_of_edges(), 1)
        with self.assertRaises(ValueError):
            rca_matrix([[0, 0], [1, 2], [3, 4]])

    def test_zero_coupling_and_convergent_linear_system(self):
        shares = np.array([0.4, 0.6])
        adjacency = np.array([[0, 1], [1, 0]])
        direct = conditional_diffusion(shares, adjacency, 0, shock=0.2, coupling=0)
        self.assertAlmostEqual(direct["aggregate"], 0.08)
        transmitted = conditional_diffusion(shares, adjacency, 0, shock=0.2, coupling=0.25)
        np.testing.assert_allclose((np.eye(2) - 0.25 * adjacency) @ transmitted["total"], [0.2, 0])
        self.assertLess(transmitted["spectralRadius"], 1)
        with self.assertRaises(ValueError):
            conditional_diffusion(shares, adjacency, 0, coupling=1)


class SurvivalTests(unittest.TestCase):
    def test_hand_calculated_ties_censoring(self):
        result = kaplan_meier([1, 2, 2, 3], [1, 1, 0, 1])
        np.testing.assert_allclose(result["survival"], [0.75, 0.5, 0])
        np.testing.assert_array_equal(result["atRisk"], [4, 3, 1])

    def test_delayed_entry_changes_risk_set(self):
        result = kaplan_meier([1, 2, 3, 4], [1, 1, 0, 1], entry=[0, 0, 1.5, 2.5])
        np.testing.assert_array_equal(result["atRisk"], [2, 2, 1])
        np.testing.assert_allclose(result["survival"], [0.5, 0.25, 0])
        with self.assertRaises(ValueError):
            kaplan_meier([1, 2, 3], [1, 0, 1], entry=[1, 0, 0])


class CausalTests(unittest.TestCase):
    def fixture(self):
        rng = np.random.default_rng(42)
        rows = []
        for unit in range(40):
            intercept = rng.normal()
            treated = int(unit >= 20)
            for period in range(8):
                post = int(period >= 4)
                rows.append({"unit": str(unit), "period": period, "treated": treated, "post": post,
                             "outcome": intercept + 0.3 * period + 2.5 * treated * post + rng.normal(0, 0.2)})
        return pd.DataFrame(rows)

    def test_known_additive_effect_recovered(self):
        result = difference_in_differences(self.fixture())
        self.assertAlmostEqual(result["effect"], 2.5, delta=0.15)
        self.assertLess(result["lower"], 2.5)
        self.assertGreater(result["upper"], 2.5)
        self.assertEqual(result["clusters"], 40)

    def test_rejects_staggered_and_missing_panel(self):
        data = self.fixture()
        with self.assertRaises(ValueError):
            difference_in_differences(data.iloc[:-1])
        data.loc[0, "post"] = 1
        with self.assertRaises(ValueError):
            difference_in_differences(data)


if __name__ == "__main__":
    unittest.main()
